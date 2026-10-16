import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
describe('Migration registration without automatic execution', () => {
  it.each(['data-source.ts','docker-test-data-source.ts','docker-main-test-data-source.ts','app.module.ts','docker-phone-migration-data-source.ts'])('%s preserves its explicit migration scope and disables automatic writes', file => {
    const text = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const arrays: string[][] = [];
    const flags: Record<string, ts.SyntaxKind[]> = {};
    const visit = (node: ts.Node) => {
      if (ts.isPropertyAssignment(node)) {
        const name = node.name.getText(source);
        if (name === 'migrations' && ts.isArrayLiteralExpression(node.initializer)) arrays.push(node.initializer.elements.map(e => e.getText(source)));
        if (name === 'migrationsRun' || name === 'synchronize') (flags[name] ??= []).push(node.initializer.kind);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(arrays).toHaveLength(1);
    const phoneOnly = file === 'docker-phone-migration-data-source.ts';
    expect(arrays[0].at(-1)).toBe(file.startsWith('docker-') && !phoneOnly
      ? 'AddUsersEmailUnique1791888000000' : 'AddUserPhoneAndSmsConsent1792195200000');
    expect(new Set(arrays[0]).size).toBe(arrays[0].length);
    expect(flags).toEqual({ migrationsRun: [ts.SyntaxKind.FalseKeyword], synchronize: [ts.SyntaxKind.FalseKeyword] });
    if (phoneOnly) expect(arrays[0]).toEqual(['AddUserPhoneAndSmsConsent1792195200000']);
    else if (file.startsWith('docker-')) expect(arrays[0]).toEqual([
      'InitialApplicationTables1733927999000','AddMarketingPreferences1733928000000',
      'AddEmailVerification1735000000000','AddForumUsers1791394800000',
      'CreateBonusTables1791630000000','AddUsersEmailUnique1791888000000',
    ]);
    else expect(arrays[0].slice(-2)).toEqual([
      'AddUsersEmailUnique1791888000000','AddUserPhoneAndSmsConsent1792195200000',
    ]);
  });
});
