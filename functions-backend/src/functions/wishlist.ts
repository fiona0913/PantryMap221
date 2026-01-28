// IMPORTANT: Do NOT auto-refactor or delete this file.
// This file registers Azure Functions via app.http at top-level.

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";
import { corsHeaders, handleOptions } from "../lib/cors";

function json(status: number, body: any, origin?: string | null): HttpResponseInit {
  return {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    body: JSON.stringify(body),
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeItem(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function getContainers() {
  const endpoint = requireEnv("COSMOS_ENDPOINT");
  const key = requireEnv("COSMOS_KEY");
  const dbId = process.env.COSMOS_DATABASE || "microPantry";
  const eventsId = process.env.COSMOS_CONTAINER_WISHLIST_EVENTS || "wishlistEvents";
  const aggId = process.env.COSMOS_CONTAINER_WISHLIST_AGG || "wishlistAgg";

  const client = new CosmosClient({ endpoint, key });
  const db = client.database(dbId);
  return {
    events: db.container(eventsId),
    agg: db.container(aggId),
  };
}

async function handleGet(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const origin = req.headers.get("origin");
  const pantryId = req.query.get("pantryId")?.trim();
  if (!pantryId) return json(400, { error: "Missing pantryId." }, origin);

  const { agg } = getContainers();

  // Query within pantry partition; we keep it simple/compatible (no extra options object)
  const querySpec = {
    query:
      "SELECT c.id, c.pantryId, c.itemDisplay, c.count, c.updatedAt FROM c WHERE c.pantryId = @pantryId ORDER BY c.count DESC",
    parameters: [{ name: "@pantryId", value: pantryId }],
  };

  const { resources } = await agg.items.query(querySpec).fetchAll();
  return json(200, resources || [], origin);
}

async function handlePost(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const origin = req.headers.get("origin");
  const body = (await req.json().catch(() => null)) as any;

  const pantryId = body?.pantryId?.toString().trim();
  const itemRaw = body?.item?.toString() ?? "";
  const item = itemRaw.trim();

  // quantity optional: default 1 if blank/invalid
  let quantity = Number(body?.quantity);
  if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
  if (quantity > 20) quantity = 20; // small abuse cap

  // Guardrails
  if (!pantryId) return json(400, { error: "pantryId is required." }, origin);
  if (!item) return json(400, { error: "item is required." }, origin);
  if (item.length > 40) return json(400, { error: "item too long (max 40)." }, origin);

  const normalizedItem = normalizeItem(item);
  const { events, agg } = getContainers();

  // 1) Write an event (records repeat submissions)
  const eventDoc: any = {
    id: makeId("evt"),
    pantryId: pantryId,
    item: item,
    normalizedItem: normalizedItem,
    quantity: quantity,
    createdAt: nowIso(),
    clientHint: { source: "ui" },
  };

  await events.items.create(eventDoc);

  // 2) Update aggregation doc: id = normalizedItem
  const aggId = normalizedItem;
  const maxRetries = 6;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Try read existing doc
      const readResp: any = await agg.item(aggId, pantryId).read();
      const doc = readResp.resource;

      if (!doc) {
        // Create new aggregate
        const newDoc: any = {
          id: aggId,
          pantryId: pantryId,
          itemDisplay: normalizedItem,
          count: quantity,
          updatedAt: nowIso(),
        };
        await agg.items.create(newDoc);
        return json(201, { ok: true, agg: newDoc }, origin);
      }

      const etag = readResp.headers?.etag;
      doc.count = Number(doc.count || 0) + quantity;
      doc.updatedAt = nowIso();

      // Replace with optimistic concurrency; use any for SDK compatibility
      await (agg.item(aggId, pantryId) as any).replace(doc, {
        accessCondition: { type: "IfMatch", condition: etag },
      } as any);

      return json(201, {
        ok: true,
        agg: {
          id: doc.id,
          pantryId: doc.pantryId,
          itemDisplay: doc.itemDisplay,
          count: doc.count,
          updatedAt: doc.updatedAt,
        },
      }, origin);
    } catch (err: any) {
      const code = err?.code;
      const msg = err?.message || "";

      // If doc doesn't exist, create it (race-safe enough for MVP)
      if (code === 404) {
        const newDoc: any = {
          id: aggId,
          pantryId: pantryId,
          itemDisplay: normalizedItem,
          count: quantity,
          updatedAt: nowIso(),
        };
        await agg.items.create(newDoc);
        return json(201, { ok: true, agg: newDoc }, origin);
      }

      // If ETag conflict, retry
      if (code === 412 || msg.includes("Precondition") || msg.toLowerCase().includes("etag")) {
        continue;
      }

      ctx.error("wishlist POST failed:", err);
      return json(500, { error: "Failed to update wishlist.", detail: msg || String(err) }, origin);
    }
  }

  return json(500, { error: "Failed to update wishlist (retry limit)." }, origin);
}

app.http("wishlist", {
  methods: ["GET", "POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    if (req.method === "OPTIONS") {
      return handleOptions(req);
    }
    const origin = req.headers.get("origin");
    try {
      if (req.method === "GET") return await handleGet(req, ctx);
      return await handlePost(req, ctx);
    } catch (e: any) {
      ctx.error("wishlist handler error:", e?.message || e);
      return json(500, { error: "Wishlist function error.", detail: e?.message || String(e) }, origin);
    }
  },
});
