import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";
import { corsHeaders, handleOptions } from "../lib/cors";

function getClient() {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;

  if (!endpoint || !key) {
    throw new Error("Missing COSMOS_ENDPOINT or COSMOS_KEY. Check local.settings.json.");
  }

  return new CosmosClient({ endpoint, key });
}

export async function getPantries(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }
  const origin = req.headers.get("origin");
  try {
    const dbName = process.env.COSMOS_DATABASE ?? "microPantry";
    const containerName = process.env.COSMOS_CONTAINER_PANTRIES ?? "pantries";

    const client = getClient();
    const container = client.database(dbName).container(containerName);

    const { resources } = await container.items
        .query("SELECT c.id, c.name, c.location, c.description, c.status, c.updatedAt FROM c")
        .fetchAll();

    return {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      body: JSON.stringify(resources ?? []),
    };
  } catch (err: any) {
    context.log("getPantries error:", err?.message || err);
    return {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      body: JSON.stringify({
        error: "Failed to fetch pantries.",
        detail: err?.message || String(err),
      }),
    };
  }
}

app.http("pantries", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  handler: getPantries,
});

