# pylon-kb-mcp

An MCP (Model Context Protocol) server that exposes the **Pylon Knowledge Base API** as tools. Purpose-built to complement the general `pylon-mcp` server, which doesn't cover the full KB surface (collections, article CRUD, route redirects).

Docs reference: https://docs.usepylon.com/pylon-docs/developer/api/api-reference/knowledge-base

## Tools

| Tool | Endpoint |
| --- | --- |
| `pylon_kb_list_knowledge_bases` | `GET /knowledge-bases` |
| `pylon_kb_get_knowledge_base` | `GET /knowledge-bases/{id}` |
| `pylon_kb_list_collections` | `GET /knowledge-bases/{id}/collections` |
| `pylon_kb_create_collection` | `POST /knowledge-bases/{id}/collections` |
| `pylon_kb_delete_collection` | `DELETE /knowledge-bases/{id}/collections/{collection_id}` |
| `pylon_kb_list_articles` | `GET /knowledge-bases/{id}/articles` |
| `pylon_kb_create_article` | `POST /knowledge-bases/{id}/articles` |
| `pylon_kb_get_article` | `GET /knowledge-bases/{id}/articles/{article_id}` |
| `pylon_kb_update_article` | `PATCH /knowledge-bases/{id}/articles/{article_id}` |
| `pylon_kb_delete_article` | `DELETE /knowledge-bases/{id}/articles/{article_id}` |
| `pylon_kb_create_route_redirect` | `POST /knowledge-bases/{id}/route-redirects` |

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

## Using with Claude Code / Cowork

### Option A — Install as a Claude Code plugin (recommended)

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
