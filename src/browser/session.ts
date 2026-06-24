// Playwright browser session for the Onboarded dashboard.
// One persistent context per MCP process; cookies survive restarts via userDataDir.

import os from 'node:os';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { performLogin } from './login.js';

export interface BrowserSessionConfig {
  dashboardUrl: string;
  loginEmail: string;
  loginPassword: string;
  userDataDir?: string;
  headless?: boolean;
}

export interface PageHelpers {
  navigate(relPath: string): Promise<void>;
}

export class BrowserSession {
  private context: BrowserContext | null = null;
  private initPromise: Promise<BrowserContext> | null = null;
  private readonly cfg: BrowserSessionConfig;
  private readonly userDataDir: string;

  constructor(cfg: BrowserSessionConfig) {
    this.cfg = cfg;
    this.userDataDir =
      cfg.userDataDir ?? path.join(os.homedir(), '.pylon-kb-mcp', 'chromium-profile');
  }

  private async ensureContext(): Promise<BrowserContext> {
    if (this.context) return this.context;
    if (!this.initPromise) {
      this.initPromise = chromium
        .launchPersistentContext(this.userDataDir, {
          headless: this.cfg.headless ?? true,
          viewport: { width: 1440, height: 900 },
        })
        .then((ctx) => {
          this.context = ctx;
          console.error(
            `pylon-kb-mcp: Playwright context ready (userDataDir=${this.userDataDir}, headless=${this.cfg.headless ?? true})`,
          );
          return ctx;
        });
    }
    return this.initPromise;
  }

  async withPage<T>(fn: (page: Page, helpers: PageHelpers) => Promise<T>): Promise<T> {
    const ctx = await this.ensureContext();
    const page = await ctx.newPage();
    const helpers: PageHelpers = {
      navigate: (relPath) => this.navigateAuthenticated(page, relPath),
    };
    try {
      return await fn(page, helpers);
    } finally {
      await page.close().catch(() => {});
    }
  }

  private async navigateAuthenticated(page: Page, relPath: string): Promise<void> {
    const target = new URL(relPath, this.cfg.dashboardUrl).toString();
    await page.goto(target, { waitUntil: 'networkidle' }).catch(() => {});
    if (this.isLoginPage(page.url())) {
      console.error('pylon-kb-mcp: not authenticated — performing login');
      await performLogin(page, {
        dashboardUrl: this.cfg.dashboardUrl,
        email: this.cfg.loginEmail,
        password: this.cfg.loginPassword,
      });
      await page.goto(target, { waitUntil: 'networkidle' }).catch(() => {});
      if (this.isLoginPage(page.url())) {
        throw new Error(
          `Login completed but still on a login page (${page.url()}). Update src/browser/login.ts selectors.`,
        );
      }
      console.error('pylon-kb-mcp: login successful');
    } else {
      console.error(`pylon-kb-mcp: reusing persisted session (${page.url()})`);
    }
  }

  private isLoginPage(currentUrl: string): boolean {
    try {
      const u = new URL(currentUrl);
      return /\/(login|signin|sign-in|auth)(?:\/|$)/.test(u.pathname);
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.context) {
      const ctx = this.context;
      this.context = null;
      this.initPromise = null;
      await ctx.close().catch(() => {});
    }
  }
}
