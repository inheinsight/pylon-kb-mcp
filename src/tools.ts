// Shared MCP tool definitions used by both the stdio entry (src/index.ts)
// and the Cloudflare Worker entry (src/worker.ts).

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const tools: ToolDef[] = [
  {
    name: 'list_knowledge_bases',
    description:
      "List all Pylon knowledge bases for the organization. Returns id, title, slug, default_language, and supported_languages for each. Start here to find the knowledge base ID you'll need for collection/article operations.",
    inputSchema: {
      type: 'object',
      properties: {
        cursor: { type: 'string', description: 'Pagination cursor from a prior response.' },
        limit: { type: 'number', description: 'Max results per page.' },
      },
    },
  },
  {
    name: 'get_knowledge_base',
    description: 'Fetch a single knowledge base by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        knowledge_base_id: { type: 'string', description: 'Knowledge base ID.' },
      },
      required: ['knowledge_base_id'],
    },
  },
  {
    name: 'list_collections',
    description: 'List all collections inside a knowledge base. Collections group related articles.',
    inputSchema: {
      type: 'object',
      properties: {
        knowledge_base_id: { type: 'string', description: 'Knowledge base ID.' },
        cursor: { type: 'string', description: 'Pagination cursor.' },
        limit: { type: 'number', description: 'Max results per page.' },
      },
      required: ['knowledge_base_id'],
    },
  },
  {
    name: 'create_collection',
    description: 'Create a new collection inside a knowledge base.',
    inputSchema: {
      type: 'object',
      properties: {
        knowledge_base_id: { type: 'string', description: 'Knowledge base to create the collection in.' },
        title: { type: 'string', description: 'Collection title shown to readers.' },
        description: { type: 'string', description: 'Optional collection description.' },
        slug: { type: 'string', description: 'Optional URL slug for the collection.' },
        parent_collection_id: { type: 'string', description: 'Optional parent collection ID for nesting.' },
        translations: {
          type: 'object',
          description:
            'Optional translation map keyed by language code, e.g. { "es": { "title": "...", "description": "..." } }.',
          additionalProperties: true,
        },
      },
      required: ['knowledge_base_id', 'title'],
    },
  },
  {
    name: 'delete_collection',
    description:
      'Permanently delete a collection AND every article it contains. This cannot be undone — confirm with the user before calling.',
    inputSchema: {
      type: 'object',
      properties: {
        knowledge_base_id: { type: 'string' },
        collection_id: { type: 'string' },
      },
      required: ['knowledge_base_id', 'collection_id'],
    },
  },
  {
    name: 'list_articles',
    description: 'List articles in a knowledge base with pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        knowledge_base_id: { type: 'string' },
        cursor: { type: 'string', description: 'Pagination cursor.' },
        limit: { type: 'number', description: 'Results per page (1-1000, default 100).' },
        language: { type: 'string', description: 'Language code filter, e.g. "en".' },
      },
      required: ['knowledge_base_id'],
    },
  },
  {
    name: 'create_article',
    description:
      'Create a new article. Articles are drafts unless is_published is true. Provide body_html for the article body; author_user_id is the Pylon user ID of the author.',
    inputSchema: {
      type: 'object',
      properties: {
        knowledge_base_id: { type: 'string' },
        title: { type: 'string', description: 'Article title.' },
        body_html: { type: 'string', description: 'HTML body of the article.' },
        author_user_id: { type: 'string', description: 'Pylon user ID of the author.' },
        is_published: { type: 'boolean', description: 'Publish immediately on create. Default false (draft).' },
        slug: { type: 'string', description: 'Optional URL slug.' },
        collection_id: { type: 'string', description: 'Optional collection to place the article in.' },
        translations: {
          type: 'object',
          description: 'Optional translation map keyed by language code.',
          additionalProperties: true,
        },
        visibility_config: {
          type: 'object',
          description: 'Optional visibility rules for who can see the article.',
          additionalProperties: true,
        },
      },
      required: ['knowledge_base_id', 'title', 'body_html', 'author_user_id'],
    },
  },
  {
    name: 'get_article',
    description:
      'Fetch a single article by ID. Returns both current_draft_content_html and current_published_content_html plus publish state.',
    inputSchema: {
      type: 'object',
      properties: {
        knowledge_base_id: { type: 'string' },
        article_id: { type: 'string' },
        language: { type: 'string', description: 'Optional language code to fetch a specific translation.' },
      },
      required: ['knowledge_base_id', 'article_id'],
    },
  },
  {
    name: 'update_article',
    description:
      'Update an article. Provided fields overwrite the current draft. Set is_published true to publish the draft. Only include fields you want to change.',
    inputSchema: {
      type: 'object',
      properties: {
        knowledge_base_id: { type: 'string' },
        article_id: { type: 'string' },
        title: { type: 'string' },
        body_html: { type: 'string' },
        is_published: { type: 'boolean' },
        slug: { type: 'string' },
        collection_id: { type: 'string' },
        translations: {
          type: 'object',
          description: 'Translation map keyed by language code.',
          additionalProperties: true,
        },
        visibility_config: {
          type: 'object',
          description: 'Visibility rules.',
          additionalProperties: true,
        },
      },
      required: ['knowledge_base_id', 'article_id'],
    },
  },
  {
    name: 'delete_article',
    description: 'Permanently delete an article. Cannot be undone — confirm with the user first.',
    inputSchema: {
      type: 'object',
      properties: {
        knowledge_base_id: { type: 'string' },
        article_id: { type: 'string' },
      },
      required: ['knowledge_base_id', 'article_id'],
    },
  },
  {
    name: 'create_route_redirect',
    description:
      'Create a route redirect in a knowledge base (e.g. redirect an old article URL to a new location).',
    inputSchema: {
      type: 'object',
      properties: {
        knowledge_base_id: { type: 'string' },
        from_path: { type: 'string', description: 'Source path to redirect from.' },
        to_path: { type: 'string', description: 'Destination path to redirect to.' },
        redirect_type: { type: 'string', description: 'Optional redirect type, e.g. "301" or "302".' },
      },
      required: ['knowledge_base_id', 'from_path', 'to_path'],
    },
  },
];
