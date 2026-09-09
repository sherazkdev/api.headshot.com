import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_PORT = process.env.API_PORT || "3016";

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params;
  const target = `http://127.0.0.1:${API_PORT}/v1/${segments.join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  const authorization = req.headers.get("authorization");
  if (authorization) headers.set("authorization", authorization);
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) headers.set("x-api-key", apiKey);
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", "application/json");

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const res = await fetch(target, {
    method,
    headers,
    body: hasBody ? Buffer.from(await req.arrayBuffer()) : undefined,
    cache: "no-store",
    redirect: "manual",
  });

  const out = new Headers();
  const resType = res.headers.get("content-type");
  if (resType) out.set("content-type", resType);
  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const item of setCookies) out.append("set-cookie", item);

  return new Response(res.body, { status: res.status, headers: out });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
