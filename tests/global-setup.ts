import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { FullConfig } from '@playwright/test';

function loadEnv() {
  const text = readFileSync('.env', 'utf8');
  return Object.fromEntries(text.split(/\r?\n/).filter(Boolean).map((line: string) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
}

export default async function globalSetup(config: FullConfig) {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  const email = process.env.E2E_EMAIL || 'itayk93@gmail.com';
  const password = process.env.E2E_PASSWORD || 'REDACTED_TEST_PASSWORD';
  if (!url || !anonKey) throw new Error('Missing Supabase E2E config');

  const login = await fetch(`${url}/functions/v1/legacy-login`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = await login.json() as { token_hash?: string; error?: string };
  if (!login.ok || !loginBody.token_hash) throw new Error(`E2E login failed: ${loginBody.error || login.status}`);

  const verify = await fetch(`${url}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'email', token_hash: loginBody.token_hash }),
  });
  const session = await verify.json() as Record<string, unknown>;
  if (!verify.ok || !session.access_token || !session.refresh_token) throw new Error(`E2E session failed: ${verify.status}`);

  const origin = new URL(process.env.E2E_BASE_URL || 'http://127.0.0.1:8080').origin;
  const projectRef = new URL(url).hostname.split('.')[0];
  const state = {
    cookies: [],
    origins: [{ origin, localStorage: [{ name: `sb-${projectRef}-auth-token`, value: JSON.stringify(session) }] }],
  };
  const output = path.resolve('playwright/.auth/user.json');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(state));
}
