import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { corsHeaders, handleOptions } from "../lib/cors";

function json(status: number, body: unknown, origin?: string | null): HttpResponseInit {
  return {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    body: JSON.stringify(body),
  };
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

export async function getDonations(
  req: HttpRequest,
  _ctx: InvocationContext
): Promise<HttpResponseInit> {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const origin = req.headers.get("origin");
  const pantryId = req.query.get("pantryId")?.trim() ?? "";
  const page = parsePositiveInt(req.query.get("page"), 1);
  const pageSize = parsePositiveInt(req.query.get("pageSize"), 5);

  if (!pantryId) {
    return json(400, { error: "Missing pantryId." }, origin);
  }

  return json(
    200,
    {
      items: [],
      page,
      pageSize,
      total: 0,
    },
    origin
  );
}

app.http("donations", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  handler: getDonations,
});


