import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
describe('Sixth migration registration without automatic execution', () => {
  it.each(['data-source.ts','docker-test-data-source.ts','docker-main-test-data-source.ts','app.module.ts'])('%s registers sixth last and disables automatic writes', file => {
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
    expect(arrays[0].at(-1)).toBe('AddUsersEmailUnique1791888000000');
    expect(new Set(arrays[0]).size).toBe(arrays[0].length);
    expect(flags).toEqual({ migrationsRun: [ts.SyntaxKind.FalseKeyword], synchronize: [ts.SyntaxKind.FalseKeyword] });
    if (file.startsWith('docker-')) expect(arrays[0]).toEqual([
      'InitialApplicationTables1733927999000','AddMarketingPreferences1733928000000',
      'AddEmailVerification1735000000000','AddForumUsers1791394800000',
      'CreateBonusTables1791630000000','AddUsersEmailUnique1791888000000',
    ]);
  });
});
