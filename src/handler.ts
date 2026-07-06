// Shared tool-call dispatch used by both stdio and Worker entries.
// Returns a serialized text result (or throws on a tool-level error).

import { PylonKBClient } from './pylon-kb-client.js';

export interface ToolContext {
  client: PylonKBClient;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value) {
    throw new Error(`Missing required string argument: ${name}`);
  }
  return value;
}

export async function executeTool(
  ctx: ToolContext,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { client } = ctx;

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

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
