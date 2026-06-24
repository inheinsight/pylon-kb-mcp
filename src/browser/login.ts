// Onboarded dashboard login. Single-tenant: this is the one place that knows
// the auth UI. When the auth flow changes, update this file.

import type { Page } from 'playwright';

export interface LoginConfig {
  dashboardUrl: string;
  email: string;
  password: string;
}

export async function performLogin(page: Page, cfg: LoginConfig): Promise<void> {
  const onLogin = await isOnLoginScreen(page);
  if (!onLogin) {
    await page.goto(new URL('/login', cfg.dashboardUrl).toString(), { waitUntil: 'networkidle' }).catch(() => {});
  }

  const emailFilled = await tryFill(
    page,
    [
      'input[type="email"]',
      'input[name="email"]',
      'input[autocomplete="email"]',
      'input[id*="email" i]',
    ],
    cfg.email,
  );
  if (!emailFilled) {
    throw new Error(
      'Login: could not find an email input. Update tryFill selectors in src/browser/login.ts.',
    );
  }

  // Some auth UIs split email + password into two pages. Click "Continue" / "Next" if present.
  await tryClick(page, ['button:has-text("Continue")', 'button:has-text("Next")']);
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

  const passwordFilled = await tryFill(
    page,
    [
      'input[type="password"]',
      'input[name="password"]',
      'input[autocomplete="current-password"]',
    ],
    cfg.password,
  );
  if (!passwordFilled) {
    throw new Error(
      'Login: could not find a password input. Update tryFill selectors in src/browser/login.ts.',
    );
  }

  const submitted = await tryClick(page, [
    'button[type="submit"]',
    'button:has-text("Sign in")',
    'button:has-text("Log in")',
    'button:has-text("Continue")',
  ]);
  if (!submitted) {
    await page.keyboard.press('Enter');
  }

  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
}

async function isOnLoginScreen(page: Page): Promise<boolean> {
  try {
    const u = new URL(page.url());
    return /\/(login|signin|sign-in|auth)(?:\/|$)/.test(u.pathname);
  } catch {
    return false;
  }
}

async function tryFill(page: Page, selectors: string[], value: string): Promise<boolean> {
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el && (await el.isVisible().catch(() => false))) {
      await el.fill(value);
      return true;
    }
  }
  return false;
}

async function tryClick(page: Page, selectors: string[]): Promise<boolean> {
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el && (await el.isVisible().catch(() => false))) {
      await el.click().catch(() => {});
      return true;
    }
  }
  return false;
}
