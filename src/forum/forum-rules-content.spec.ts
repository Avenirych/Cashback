import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { FORUM_RULES } from './forum-rules';

// API preserves en/ru and adds de/fr. Any later published policy edit requires explicit review
// of the four frontend translations, rather than silently displaying stale rules.
const document = JSON.parse(readFileSync('cashback-frontend/src/content/forumRules.json', 'utf8'));
test.each([
  ['ru', '1f1292a284347653ad76d9422e69e487e50dca8d27452b291939578246767aba'],
  ['en', 'ef813e80a52c79827b5e167c80df67585cc3fa8eff20fd53d61c0a7f6e16c550'],
])('original eight frontend %s sections remain verbatim', (lang, digest) => {
  expect(createHash('sha256').update(JSON.stringify(document.rules[lang].slice(0, 8))).digest('hex')).toBe(digest);
});
test.each(['en', 'ru', 'de', 'fr'] as const)('frontend translations were reconciled with published %s rules', lang => {
  expect(createHash('sha256').update(FORUM_RULES[lang]).digest('hex')).toBe(document.backendDigests[lang]);
  expect(document.rules[lang].map((s:string[]) => s.join("\n")).join("\n\n")).toBe(FORUM_RULES[lang]);
});
test('all four documents have thirteen distinct complete topics, including deletion warnings and isolated demo rules', () => {
  expect(Object.keys(document.rules).sort()).toEqual(['de', 'en', 'fr', 'ru']);
  for (const sections of Object.values(document.rules) as string[][][]) {
    expect(sections).toHaveLength(13);
    expect(new Set(sections.map(s => s[0])).size).toBe(13);
    for (const section of sections) {
      expect(section).toHaveLength(2);
      expect(section[0].length).toBeGreaterThan(5);
      expect(section[1].length).toBeGreaterThan(80);
    }
  }
  expect(document.rules.de[8][1]).toContain('nicht rückgängig');
  expect(document.rules.fr[8][1]).toContain('irréversible');
});
