import { HttpRequest, HttpResponseInit } from "@azure/functions";

const ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:5500",
  "http://localhost:5500",
]);

function resolveAllowedOrigin(origin?: string | null): string {
  if (!origin) return "*";
  return ALLOWED_ORIGINS.has(origin) ? origin : "*";
}

export function corsHeaders(origin?: string | null): Record<string, string> {
  const allowOrigin = resolveAllowedOrigin(origin);
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,x-api-key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function handleOptions(req: HttpRequest): HttpResponseInit {
  const origin = req.headers.get("origin");
  return {
    status: 204,
    headers: corsHeaders(origin),
  };
}

