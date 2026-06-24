#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { PylonKBClient } from './pylon-kb-client.js';
import { tools } from './tools.js';
import { executeTool, type ToolContext } from './handler.js';
import { BrowserSession } from './browser/session.js';

const PYLON_API_TOKEN = process.env.PYLON_API_TOKEN;
const PYLON_BASE_URL = process.env.PYLON_BASE_URL;

const ONBOARDED_DASHBOARD_URL = process.env.ONBOARDED_DASHBOARD_URL;
const ONBOARDED_LOGIN_EMAIL = process.env.ONBOARDED_LOGIN_EMAIL;
const ONBOARDED_LOGIN_PASSWORD = process.env.ONBOARDED_LOGIN_PASSWORD;
const PLAYWRIGHT_USER_DATA_DIR = process.env.PLAYWRIGHT_USER_DATA_DIR;
const PLAYWRIGHT_HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== 'false';

let client: PylonKBClient | null = null;
if (PYLON_API_TOKEN) {
  client = new PylonKBClient({ apiToken: PYLON_API_TOKEN, baseUrl: PYLON_BASE_URL });
}

let browser: BrowserSession | null = null;
if (ONBOARDED_DASHBOARD_URL && ONBOARDED_LOGIN_EMAIL && ONBOARDED_LOGIN_PASSWORD) {
  browser = new BrowserSession({
    dashboardUrl: ONBOARDED_DASHBOARD_URL,
    loginEmail: ONBOARDED_LOGIN_EMAIL,
    loginPassword: ONBOARDED_LOGIN_PASSWORD,
    userDataDir: PLAYWRIGHT_USER_DATA_DIR,
    headless: PLAYWRIGHT_HEADLESS,
  });
}

const server = new Server(
  { name: 'pylon-kb-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools as Tool[],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (!client) {
    return {
      content: [
        {
          type: 'text',
          text: 'PYLON_API_TOKEN environment variable is not set. Configure it and restart the MCP server.',
        },
      ],
      isError: true,
    };
  }

  const ctx: ToolContext = { client, browser };

  try {
    const result = await executeTool(
      ctx,
      req.params.name,
      (req.params.arguments ?? {}) as Record<string, unknown>,
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: message }],
      isError: true,
    };
  }
});

async function shutdown(signal: string): Promise<void> {
  console.error(`pylon-kb-mcp: received ${signal}, shutting down`);
  if (browser) {
    await browser.close();
  }
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('pylon-kb-mcp-server running on stdio');
  if (browser) {
    console.error('pylon-kb-mcp: screenshot tools enabled');
  } else {
    console.error(
      'pylon-kb-mcp: screenshot tools DISABLED — set ONBOARDED_DASHBOARD_URL, ONBOARDED_LOGIN_EMAIL, ONBOARDED_LOGIN_PASSWORD to enable',
    );
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
