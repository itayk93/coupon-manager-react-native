import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const migrationsDir = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));
const migrations = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'));
const roles = ['anon', 'authenticated', 'service_role'];

describe('explicit Data API access in table-creating migrations', () => {
  for (const migration of migrations) {
    const sql = readFileSync(path.join(migrationsDir, migration), 'utf8')
      .replace(/--[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const tables = [...sql.matchAll(/\bcreate\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?(?:(?<schema>"[a-z_0-9]+"|[a-z_0-9]+)\.)?(?<table>"[a-z_0-9]+"|[a-z_0-9]+)\s*(?=\(|as\b|partition\b)/gi)]
      .filter((match) => !match.groups!.schema || match.groups!.schema.replaceAll('"', '').toLowerCase() === 'public')
      .map((match) => match.groups!.table.replaceAll('"', '').toLowerCase());

    for (const table of new Set(tables)) {
      it(`${migration}: ${table} declares RLS and an access decision for every API role`, () => {
        const target = `(?:"public"|public)\\.(?:"${table}"|${table})`;
        expect(sql).toMatch(new RegExp(`alter\\s+table\\s+(?:if\\s+exists\\s+)?${target}\\s+enable\\s+row\\s+level\\s+security`, 'i'));

        for (const role of roles) {
          // Both grants and explicit revocations document an intentional decision.
          const decision = new RegExp(`(?:grant\\s+[^;]+?\\s+on\\s+(?:table\\s+)?${target}\\s+to|revoke\\s+[^;]+?\\s+on\\s+(?:table\\s+)?${target}\\s+from)\\s+[^;]*\\b${role}\\b[^;]*;`, 'i');
          expect(sql, `${table} needs an explicit grant or revoke for ${role}`).toMatch(decision);
        }
      });
    }
  }
});
