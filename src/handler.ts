// Shared tool-call dispatch used by both stdio and Worker entries.
// Returns a serialized text result (or throws on a tool-level error).

import { PylonKBClient } from './pylon-kb-client.js';
import type { BrowserSession } from './browser/session.js';
import { performCapture, type Annotation, type CaptureOptions } from './browser/screenshot.js';

export interface ToolContext {
  client: PylonKBClient;
  browser: BrowserSession | null;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value) {
    throw new Error(`Missing required string argument: ${name}`);
  }
  return value;
}

function requireBrowser(browser: BrowserSession | null): BrowserSession {
  if (!browser) {
    throw new Error(
      'Screenshot tools require a local Node runtime with ONBOARDED_DASHBOARD_URL, ONBOARDED_LOGIN_EMAIL, and ONBOARDED_LOGIN_PASSWORD set. They are not available in the Cloudflare Worker entry.',
    );
  }
  return browser;
}

interface FlowStep {
  path?: string;
  click?: string;
  fill?: { selector: string; value: string };
  wait_for?: string;
  screenshot?: { annotations?: Annotation[]; clip_to_selector?: string; viewport?: { width: number; height: number } };
}

export async function executeTool(
  ctx: ToolContext,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { client, browser } = ctx;

  switch (toolName) {
    case 'list_knowledge_bases':
      return client.listKnowledgeBases({
        cursor: args.cursor as string | undefined,
        limit: args.limit as number | undefined,
      });

    case 'get_knowledge_base':
      return client.getKnowledgeBase(requireString(args.knowledge_base_id, 'knowledge_base_id'));

    case 'list_collections':
      return client.listCollections(requireString(args.knowledge_base_id, 'knowledge_base_id'), {
        cursor: args.cursor as string | undefined,
        limit: args.limit as number | undefined,
      });

    case 'create_collection': {
      const { knowledge_base_id, ...body } = args;
      return client.createCollection(requireString(knowledge_base_id, 'knowledge_base_id'), body);
    }

    case 'delete_collection':
      return client.deleteCollection(
        requireString(args.knowledge_base_id, 'knowledge_base_id'),
        requireString(args.collection_id, 'collection_id'),
      );

    case 'list_articles':
      return client.listArticles(requireString(args.knowledge_base_id, 'knowledge_base_id'), {
        cursor: args.cursor as string | undefined,
        limit: args.limit as number | undefined,
        language: args.language as string | undefined,
      });

    case 'create_article': {
      const { knowledge_base_id, ...body } = args;
      return client.createArticle(requireString(knowledge_base_id, 'knowledge_base_id'), body);
    }

    case 'get_article':
      return client.getArticle(
        requireString(args.knowledge_base_id, 'knowledge_base_id'),
        requireString(args.article_id, 'article_id'),
        { language: args.language as string | undefined },
      );

    case 'update_article': {
      const { knowledge_base_id, article_id, ...body } = args;
      return client.updateArticle(
        requireString(knowledge_base_id, 'knowledge_base_id'),
        requireString(article_id, 'article_id'),
        body,
      );
    }

    case 'delete_article':
      return client.deleteArticle(
        requireString(args.knowledge_base_id, 'knowledge_base_id'),
        requireString(args.article_id, 'article_id'),
      );

    case 'create_route_redirect': {
      const { knowledge_base_id, ...body } = args;
      return client.createRouteRedirect(requireString(knowledge_base_id, 'knowledge_base_id'), body);
    }

    case 'capture_screenshot': {
      const session = requireBrowser(browser);
      const path = requireString(args.path, 'path');
      const captureOpts: CaptureOptions = {
        wait_for: args.wait_for as string | undefined,
        viewport: args.viewport as { width: number; height: number } | undefined,
        annotations: args.annotations as Annotation[] | undefined,
        clip_to_selector: args.clip_to_selector as string | undefined,
      };
      const result = await session.withPage(async (page, helpers) => {
        await helpers.navigate(path);
        return performCapture(page, captureOpts);
      });
      const filename = `screenshot-${Date.now()}.png`;
      const attachment = await client.uploadAttachment(result.buffer, filename);
      return {
        url: attachment.url,
        attachment_id: attachment.id,
        width: result.width,
        height: result.height,
        captured_at: result.capturedAt,
      };
    }

    case 'capture_flow': {
      const session = requireBrowser(browser);
      const steps = args.steps as FlowStep[] | undefined;
      if (!Array.isArray(steps) || steps.length === 0) {
        throw new Error('capture_flow: steps must be a non-empty array');
      }
      const screenshots: Array<{
        url: string;
        attachment_id: string;
        step_index: number;
        width: number;
        height: number;
        captured_at: string;
      }> = [];
      await session.withPage(async (page, helpers) => {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          if (step.path) await helpers.navigate(step.path);
          if (step.click) await page.click(step.click, { timeout: 10000 });
          if (step.fill) await page.fill(step.fill.selector, step.fill.value);
          if (step.wait_for) await page.waitForSelector(step.wait_for, { timeout: 15000 });
          if (step.screenshot) {
            const result = await performCapture(page, step.screenshot);
            const filename = `flow-step-${i}-${Date.now()}.png`;
            const attachment = await client.uploadAttachment(result.buffer, filename);
            screenshots.push({
              url: attachment.url,
              attachment_id: attachment.id,
              step_index: i,
              width: result.width,
              height: result.height,
              captured_at: result.capturedAt,
            });
          }
        }
      });
      return { screenshots };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
