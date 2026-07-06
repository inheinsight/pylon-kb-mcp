// Cloudflare Worker entry — exposes the Pylon KB MCP server over HTTP
// using a spec-compliant MCP "Streamable HTTP" transport (SSE-framed responses,
// session id on initialize, and a GET event-stream clients can attach to).
//
// Endpoints:
//   POST   /mcp                     — JSON-RPC messages (SSE or JSON response)
//   GET    /mcp                     — opens the server->client SSE stream
//   DELETE /mcp                     — ends a session (no-op; server is stateless)
//   (auth) Authorization: Bearer <MCP_CLIENT_SECRET>  OR  /mcp/<MCP_CLIENT_SECRET> path
//   GET    /health                  — liveness probe (no auth)
//
// Required Worker secrets:
//   PYLON_API_TOKEN     — the Pylon bearer token (single shared token for the team)
//   MCP_CLIENT_SECRET   — random shared secret clients (Cowork, Claude Code) must present

import { PylonKBClient } from './pylon-kb-client.js';
import { tools } from './tools.js';
import { executeTool } from './handler.js';
import { jwtVerify, createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';

interface Env {
  PYLON_API_TOKEN: string;
  MCP_CLIENT_SECRET: string;
  PYLON_BASE_URL?: string;
  // Cloudflare Access (managed OAuth) — set once Access fronts this hostname.
  // ACCESS_AUD: the Access application's Audience (AUD) tag.
  // ACCESS_TEAM_DOMAIN: e.g. https://onboardedz.cloudflareaccess.com
  ACCESS_AUD?: string;
  ACCESS_TEAM_DOMAIN?: string;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: string | number | null;
  result: unknown;
}

interface JsonRpcError {
  jsonrpc: '2.0';
  id: string | number | null;
  error: { code: number; message: string; data?: unknown };
}

// Default protocol version we advertise when the client doesn't specify one.
// On initialize we echo back the client's requested version when present, so
// negotiation succeeds across 2024-11-05 / 2025-03-26 / 2025-06-18 clients.
const DEFAULT_PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'Onboarded Pylon Knowledge Base', version: '1.0.0' };

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, mcp-session-id, mcp-protocol-version, accept',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-expose-headers': 'mcp-session-id',
};

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS, ...extraHeaders },
  });
}

function errorResponse(status: number, message: string): Response {
  return jsonResponse({ error: message }, status);
}

// One SSE `message` event per JSON-RPC response, then close the stream.
function sseResponse(messages: unknown[], extraHeaders: Record<string, string> = {}): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const m of messages) {
        controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(m)}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', ...CORS_HEADERS, ...extraHeaders },
  });
}

// Long-lived server->client stream for a GET. We have no server-initiated
// messages (stateless request/response), so this just stays open with
// keepalives so the client considers the connection established.
function sseListeningStream(extraHeaders: Record<string, string> = {}): Response {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`: connected\n\n`));
      timer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          if (timer) clearInterval(timer);
        }
      }, 20000);
    },
    cancel() {
      if (timer) clearInterval(timer);
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', ...CORS_HEADERS, ...extraHeaders },
  });
}

function jsonRpcError(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcError {
  return { jsonrpc: '2.0', id, error: { code, message, data } };
}

function jsonRpcSuccess(id: string | number | null, result: unknown): JsonRpcSuccess {
  return { jsonrpc: '2.0', id, result };
}

function isAuthorized(request: Request, url: URL, env: Env): boolean {
  const expected = env.MCP_CLIENT_SECRET;
  if (!expected) return false;

  // Header: Authorization: Bearer <secret>
  const authHeader = request.headers.get('authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (match && timingSafeEqual(match[1].trim(), expected)) return true;

  // Path: /mcp/<secret>
  const segments = url.pathname.split('/').filter(Boolean); // ['mcp', '<secret>']
  if (segments.length === 2 && segments[0] === 'mcp' && timingSafeEqual(segments[1], expected)) {
    return true;
  }

  return false;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// Cloudflare Access (managed OAuth) auth. When Access fronts this hostname it
// injects a signed `Cf-Access-Jwt-Assertion` header. We validate it against the
// team's public keys and the application's AUD tag. Disabled (returns false)
// until ACCESS_AUD is configured, so this is safe to ship before Access is live.
let accessJwks: JWTVerifyGetKey | undefined;
let accessJwksDomain: string | undefined;

async function isAccessAuthorized(request: Request, env: Env): Promise<boolean> {
  const aud = env.ACCESS_AUD;
  if (!aud) return false; // Access not configured yet — fall back to the shared secret.

  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return false;

  const teamDomain = (env.ACCESS_TEAM_DOMAIN ?? 'https://onboardedz.cloudflareaccess.com').replace(/\/$/, '');
  if (!accessJwks || accessJwksDomain !== teamDomain) {
    accessJwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    accessJwksDomain = teamDomain;
  }

  try {
    await jwtVerify(token, accessJwks, { issuer: teamDomain, audience: aud });
    return true;
  } catch {
    return false;
  }
}

async function handleRpc(req: JsonRpcRequest, env: Env): Promise<JsonRpcSuccess | JsonRpcError | null> {
  const id = req.id ?? null;

  switch (req.method) {
    case 'initialize': {
      const requested = (req.params?.protocolVersion as string | undefined) ?? DEFAULT_PROTOCOL_VERSION;
      return jsonRpcSuccess(id, {
        protocolVersion: requested,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    }

    case 'notifications/initialized':
    case 'notifications/cancelled':
      // Notifications have no id and expect no response.
      return null;

    case 'ping':
      return jsonRpcSuccess(id, {});

    case 'tools/list':
      return jsonRpcSuccess(id, { tools });

    case 'tools/call': {
      const params = req.params ?? {};
      const name = params.name as string | undefined;
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      if (!name) {
        return jsonRpcError(id, -32602, 'Missing tool name in tools/call params');
      }
      if (!env.PYLON_API_TOKEN) {
        return jsonRpcSuccess(id, {
          content: [{ type: 'text', text: 'Server is not configured: PYLON_API_TOKEN secret is missing.' }],
          isError: true,
        });
      }
      const client = new PylonKBClient({
        apiToken: env.PYLON_API_TOKEN,
        baseUrl: env.PYLON_BASE_URL,
      });
      try {
        const result = await executeTool({ client }, name, args);
        return jsonRpcSuccess(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonRpcSuccess(id, {
          content: [{ type: 'text', text: message }],
          isError: true,
        });
      }
    }

    default:
      return jsonRpcError(id, -32601, `Method not found: ${req.method}`);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Health check (no auth)
    if (request.method === 'GET' && url.pathname === '/health') {
      return jsonResponse({ ok: true, server: SERVER_INFO });
    }

    // Only /mcp and /mcp/<secret> beyond this point.
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'mcp' || segments.length > 2) {
      return errorResponse(404, 'Not Found');
    }

    // Authorized if EITHER Cloudflare Access vouched for the request (managed
    // OAuth, validated via the injected JWT) OR the shared secret is presented.
    if (!(await isAccessAuthorized(request, env)) && !isAuthorized(request, url, env)) {
      return errorResponse(401, 'Unauthorized — authenticate via Cloudflare Access, or provide MCP_CLIENT_SECRET via `Authorization: Bearer <secret>` header or `/mcp/<secret>` path.');
    }

    // GET — open the server->client SSE stream the client attaches to.
    if (request.method === 'GET') {
      const sessionId = request.headers.get('mcp-session-id') ?? crypto.randomUUID();
      return sseListeningStream({ 'mcp-session-id': sessionId });
    }

    // DELETE — session teardown. Stateless server, so just acknowledge.
    if (request.method === 'DELETE') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return errorResponse(405, 'Method Not Allowed');
    }

    let body: JsonRpcRequest | JsonRpcRequest[];
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, 'Invalid JSON body');
    }

    // Support both single request and batch.
    const isBatch = Array.isArray(body);
    const requests = isBatch ? (body as JsonRpcRequest[]) : [body as JsonRpcRequest];
    const responses: Array<JsonRpcSuccess | JsonRpcError> = [];
    let isInitialize = false;

    for (const req of requests) {
      if (!req || typeof req !== 'object' || req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
        responses.push(jsonRpcError(null, -32600, 'Invalid Request'));
        continue;
      }
      if (req.method === 'initialize') isInitialize = true;
      const res = await handleRpc(req, env);
      if (res) responses.push(res);
    }

    // All inputs were notifications/responses — ack with 202 (Streamable HTTP).
    if (responses.length === 0) {
      return new Response(null, { status: 202, headers: CORS_HEADERS });
    }

    // Issue/propagate a session id; mint a fresh one on initialize.
    const incomingSession = request.headers.get('mcp-session-id');
    const sessionId = isInitialize ? crypto.randomUUID() : incomingSession ?? crypto.randomUUID();
    const sessionHeader = { 'mcp-session-id': sessionId };

    // Prefer SSE framing when the client accepts it (Claude's client requires it
    // to complete the connection); fall back to a single JSON object otherwise.
    const accept = request.headers.get('accept') ?? '';
    if (accept.includes('text/event-stream')) {
      return sseResponse(isBatch ? responses : [responses[0]], sessionHeader);
    }
    return jsonResponse(isBatch ? responses : responses[0], 200, sessionHeader);
  },
};
