/**
 * XSS guard: no user data may reach dangerous HTML sinks.
 *
 * React JSX escapes text nodes by default; the risk is manual string
 * construction or dangerouslySetInnerHTML with data. This pins the rule that
 * any future `dangerouslySetInnerHTML` is static-only.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

test('dangerouslySetInnerHTML is static CSS only in the native html entry', () => {
  const path = resolve('app/+html.tsx');
  const src = readFileSync(path, 'utf8');
  expect(src).toContain('dangerouslySetInnerHTML');
  expect(src).not.toMatch(/\$\{.*\}/);
});
