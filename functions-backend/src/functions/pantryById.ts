import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";
import { corsHeaders, handleOptions } from "../lib/cors";

function getClient() {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  if (!endpoint || !key) throw new Error("Missing COSMOS_ENDPOINT or COSMOS_KEY.");
  return new CosmosClient({ endpoint, key });
}

export async function getPantryById(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }
  const origin = req.headers.get("origin");
  try {
    const id = req.params.id;
    if (!id) {
      return {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        body: JSON.stringify({ error: "Missing pantry id." })
      };
    }

    const dbName = process.env.COSMOS_DATABASE ?? "microPantry";
    const containerName = process.env.COSMOS_CONTAINER_PANTRIES ?? "pantries";

    const client = getClient();
    const container = client.database(dbName).container(containerName);

    // 因为 partition key = /id，所以这里 partitionKey 也用 id
    const { resource } = await container.item(id, id).read();

    if (!resource) {
      return {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        body: JSON.stringify({ error: "Pantry not found." })
      };
    }

    // 清洗掉 Cosmos metadata
    const cleaned = {
      id: resource.id,
      name: resource.name,
      location: resource.location,
      description: resource.description,
      status: resource.status,
      updatedAt: resource.updatedAt
    };

    return {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      body: JSON.stringify(cleaned)
    };
  } catch (err: any) {
    context.log("getPantryById error:", err?.message || err);
    return {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      body: JSON.stringify({ error: "Failed to fetch pantry.", detail: err?.message || String(err) })
    };
  }
}

app.http("pantryById", {
  route: "pantries/{id}",
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  handler: getPantryById
});
