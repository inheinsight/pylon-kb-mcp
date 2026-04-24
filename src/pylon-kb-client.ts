const DEFAULT_BASE_URL = 'https://api.usepylon.com';

export interface PylonKBClientOptions {
  apiToken: string;
  baseUrl?: string;
}

type QueryValue = string | number | boolean | undefined | null;

interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
}

export class PylonKBClient {
  private readonly apiToken: string;
  private readonly baseUrl: string;

  constructor(opts: PylonKBClientOptions) {
    if (!opts.apiToken) {
      throw new Error('PylonKBClient: apiToken is required');
    }
    this.apiToken = opts.apiToken;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  }

  private async request(method: string, path: string, opts: RequestOptions = {}): Promise<unknown> {
    const url = new URL(this.baseUrl + path);
    if (opts.query) {
      for (const [key, value] of Object.entries(opts.query)) {
        if (value === undefined || value === null) continue;
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiToken}`,
      Accept: 'application/json',
    };
    let body: string | undefined;
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }

    const res = await fetch(url, { method, headers, body });
    const text = await res.text();
    let parsed: unknown = text;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // leave as raw text
      }
    } else {
      parsed = null;
    }

    if (!res.ok) {
      const detail = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
      throw new Error(`Pylon ${method} ${path} failed with ${res.status} ${res.statusText}: ${detail}`);
    }
    return parsed;
  }

  listKnowledgeBases(params: { cursor?: string; limit?: number } = {}) {
    return this.request('GET', '/knowledge-bases', { query: params });
  }

  getKnowledgeBase(id: string) {
    return this.request('GET', `/knowledge-bases/${encodeURIComponent(id)}`);
  }

  listCollections(kbId: string, params: { cursor?: string; limit?: number } = {}) {
    return this.request('GET', `/knowledge-bases/${encodeURIComponent(kbId)}/collections`, { query: params });
  }

  createCollection(kbId: string, body: Record<string, unknown>) {
    return this.request('POST', `/knowledge-bases/${encodeURIComponent(kbId)}/collections`, { body });
  }

  deleteCollection(kbId: string, collectionId: string) {
    return this.request(
      'DELETE',
      `/knowledge-bases/${encodeURIComponent(kbId)}/collections/${encodeURIComponent(collectionId)}`,
    );
  }

  listArticles(kbId: string, params: { cursor?: string; limit?: number; language?: string } = {}) {
    return this.request('GET', `/knowledge-bases/${encodeURIComponent(kbId)}/articles`, { query: params });
  }

  createArticle(kbId: string, body: Record<string, unknown>) {
    return this.request('POST', `/knowledge-bases/${encodeURIComponent(kbId)}/articles`, { body });
  }

  getArticle(kbId: string, articleId: string, params: { language?: string } = {}) {
    return this.request(
      'GET',
      `/knowledge-bases/${encodeURIComponent(kbId)}/articles/${encodeURIComponent(articleId)}`,
      { query: params },
    );
  }

  updateArticle(kbId: string, articleId: string, body: Record<string, unknown>) {
    return this.request(
      'PATCH',
      `/knowledge-bases/${encodeURIComponent(kbId)}/articles/${encodeURIComponent(articleId)}`,
      { body },
    );
  }

  deleteArticle(kbId: string, articleId: string) {
    return this.request(
      'DELETE',
      `/knowledge-bases/${encodeURIComponent(kbId)}/articles/${encodeURIComponent(articleId)}`,
    );
  }

  createRouteRedirect(kbId: string, body: Record<string, unknown>) {
    return this.request('POST', `/knowledge-bases/${encodeURIComponent(kbId)}/route-redirects`, { body });
  }
}
