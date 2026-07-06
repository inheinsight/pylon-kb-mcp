# pylon-kb-mcp

An MCP (Model Context Protocol) server that exposes the **Pylon Knowledge Base API** as tools. Purpose-built to complement the general `pylon-mcp` server, which doesn't cover the full KB surface (collections, article CRUD, route redirects).

Docs reference: https://docs.usepylon.com/pylon-docs/developer/api/api-reference/knowledge-base

## Hosted Worker (how the team connects)

This server runs as a Cloudflare Worker on the Onboarded account, so teammates don't run it locally or hold a Pylon token.

- **Endpoint:** `https://pylon-kb-mcp.onboarded.com/mcp` (MCP Streamable HTTP)
- **Worker secrets** (set with `wrangler secret put`, never committed):
  - `PYLON_API_TOKEN` — the shared Pylon token, used server-side only.
  - `MCP_CLIENT_SECRET` — the secret every client must present.
- **Client auth:** send `Authorization: Bearer <MCP_CLIENT_SECRET>`, or use the path form `https://pylon-kb-mcp.onboarded.com/mcp/<MCP_CLIENT_SECRET>` for clients that can't set headers.

**If you just want to use it:** install the `solutions-tools` plugin from the `onboarded` marketplace — it bundles this connector and only needs you to set the `PYLON_KB_MCP_SECRET` env var. Follow that plugin's README; you do not need anything in this repo.

**Deploy / update the Worker** (maintainers):

```bash
npx wrangler deploy
npx wrangler secret put PYLON_API_TOKEN     # first time / rotation
npx wrangler secret put MCP_CLIENT_SECRET   # first time / rotation
```

The Worker transport lives in [src/worker.ts](src/worker.ts) (spec-compliant Streamable HTTP — SSE-framed responses, session id, GET listening stream). The stdio paths below are for local development only.

## Tools

| Tool | Endpoint |
| --- | --- |
| `list_knowledge_bases` | `GET /knowledge-bases` |
| `get_knowledge_base` | `GET /knowledge-bases/{id}` |
| `list_collections` | `GET /knowledge-bases/{id}/collections` |
| `create_collection` | `POST /knowledge-bases/{id}/collections` |
| `delete_collection` | `DELETE /knowledge-bases/{id}/collections/{collection_id}` |
| `list_articles` | `GET /knowledge-bases/{id}/articles` |
| `create_article` | `POST /knowledge-bases/{id}/articles` |
| `get_article` | `GET /knowledge-bases/{id}/articles/{article_id}` |
| `update_article` | `PATCH /knowledge-bases/{id}/articles/{article_id}` |
| `delete_article` | `DELETE /knowledge-bases/{id}/articles/{article_id}` |
| `create_route_redirect` | `POST /knowledge-bases/{id}/route-redirects` |

## Install

```bash
npm install
npm run build
```

## Configuration

The server reads a Pylon bearer token from the `PYLON_API_TOKEN` environment variable. Optionally override the API host with `PYLON_BASE_URL` (defaults to `https://api.usepylon.com`).

## Run

```bash
PYLON_API_TOKEN=your_token_here npm start
```

Or during development:

```bash
PYLON_API_TOKEN=your_token_here npm run dev
```

## Using with Claude Code / Cowork (local stdio)

> For team use, prefer the hosted Worker above via the `solutions-tools` plugin. The options below run the server locally over stdio and need a local `PYLON_API_TOKEN` — useful for development or standalone use.

### Option A — Install as a Claude Code plugin

This repo ships a `.claude-plugin/marketplace.json`, so it works as a single-plugin marketplace. From a terminal (or inside a Cowork session):

```bash
claude plugin marketplace add https://github.com/inheinsight/pylon-kb-mcp.git
claude plugin install pylon-kb@pylon-kb-mcp
```

Then set your token (the plugin's `.mcp.json` reads it via `${PYLON_API_TOKEN}`):

```bash
export PYLON_API_TOKEN=your_token_here
```

### Option B — Wire up as a raw MCP server

```bash
claude mcp add -s user pylon-kb -e "PYLON_API_TOKEN=your_token_here" -- npx -y pylon-kb-mcp-server
```

### Option C — Manual JSON config

Add to your MCP config (e.g. `~/.claude.json` under `mcpServers`):

```json
{
  "mcpServers": {
    "pylon-kb": {
      "command": "npx",
      "args": ["-y", "pylon-kb-mcp-server"],
      "env": {
        "PYLON_API_TOKEN": "your_token_here"
      }
    }
  }
}
```

## License

MIT
