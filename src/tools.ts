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
  {
    name: 'capture_screenshot',
    description:
      'Navigate the Onboarded dashboard, capture a screenshot, optionally annotate it with arrows/highlights/circles drawn on the page before screenshotting, upload it to Pylon, and return the embeddable URL. Use the returned URL inside an <img src="..."> tag in body_html when calling create_article or update_article. Requires ONBOARDED_DASHBOARD_URL, ONBOARDED_LOGIN_EMAIL, ONBOARDED_LOGIN_PASSWORD env vars (local stdio runtime only — not available in the Worker entry).',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path on the dashboard, e.g. "/admin/employees". Combined with ONBOARDED_DASHBOARD_URL.',
        },
        wait_for: {
          type: 'string',
          description:
            'Optional CSS selector to wait for before screenshotting. If omitted, waits for networkidle.',
        },
        viewport: {
          type: 'object',
          description: 'Optional viewport size in CSS pixels. Defaults to 1440x900.',
          properties: {
            width: { type: 'number' },
            height: { type: 'number' },
          },
          required: ['width', 'height'],
        },
        clip_to_selector: {
          type: 'string',
          description:
            'Optional CSS selector. When provided, the screenshot is clipped to that element\'s bounding box (instead of full-page).',
        },
        annotations: {
          type: 'array',
          description:
            'Optional list of annotations rendered onto the page before screenshotting. Each annotation must have either selector or coords, and a kind.',
          items: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for the element being annotated. Provide either selector or coords.',
              },
              coords: {
                type: 'object',
                description: 'Absolute viewport coordinates if you do not have a selector. width/height optional.',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                  width: { type: 'number' },
                  height: { type: 'number' },
                },
                required: ['x', 'y'],
              },
              kind: {
                type: 'string',
                enum: ['arrow', 'highlight', 'circle'],
                description:
                  'arrow = orange arrow pointing at the element (with optional label). highlight = orange outline rectangle with dim background. circle = orange ring around the element.',
              },
              label: {
                type: 'string',
                description: 'Optional short text label rendered above an arrow annotation.',
              },
            },
            required: ['kind'],
          },
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'capture_flow',
    description:
      'Drive a multi-step flow on the Onboarded dashboard (navigate, click, fill, wait, screenshot) and return all screenshots taken. Reuses one warm browser context across steps so login happens at most once. Use this when documenting a sequence (e.g., open settings -> click "API keys" -> click "New key" -> screenshot the modal). Requires the same env vars as capture_screenshot.',
    inputSchema: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          description: 'Ordered steps. Each step can include any combination of path/click/fill/wait_for/screenshot.',
          items: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Optional. Navigate to this path before doing anything else in the step.',
              },
              click: {
                type: 'string',
                description: 'Optional. CSS selector to click after navigation/fill.',
              },
              fill: {
                type: 'object',
                description: 'Optional. Fill an input.',
                properties: {
                  selector: { type: 'string' },
                  value: { type: 'string' },
                },
                required: ['selector', 'value'],
              },
              wait_for: {
                type: 'string',
                description: 'Optional. CSS selector to wait for before continuing (e.g. before screenshotting).',
              },
              screenshot: {
                type: 'object',
                description: 'Optional. If present, capture a screenshot at this step using the same options as capture_screenshot.',
                properties: {
                  annotations: { type: 'array' },
                  clip_to_selector: { type: 'string' },
                  viewport: {
                    type: 'object',
                    properties: {
                      width: { type: 'number' },
                      height: { type: 'number' },
                    },
                    required: ['width', 'height'],
                  },
                },
              },
            },
          },
        },
      },
      required: ['steps'],
    },
  },
];
