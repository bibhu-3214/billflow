const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const ts = require('typescript');
const { ESLint } = require('eslint');
const root = path.resolve(__dirname, '..');

// Exercise the real project policy so accidental rule relaxation fails CI.
test('the TypeScript policy rejects explicit and unsafe inherited any, including suppressions', async () => {
    const eslint = new ESLint({ cwd: root });
    const snippets = [
        ['export const value: any = 1;', '@typescript-eslint/no-explicit-any'],
        ['export const value = JSON.parse("{}");', '@typescript-eslint/no-unsafe-assignment'],
        ['export function value() { return JSON.parse("{}"); }', '@typescript-eslint/no-unsafe-return'],
        ['export function value() { JSON.parse("{}").run(); }', '@typescript-eslint/no-unsafe-call'],
        ['export function value() { return JSON.parse("{}").name; }', '@typescript-eslint/no-unsafe-member-access'],
        ['declare function accept(value: string): void; accept(JSON.parse("{}").name);', '@typescript-eslint/no-unsafe-argument'],
        ['// @ts-ignore\nexport const value: string = 1;', '@typescript-eslint/ban-ts-comment'],
        ['/* eslint-disable @typescript-eslint/no-explicit-any */\nexport const value: any = 1;', '@typescript-eslint/no-explicit-any'],
    ];
    for (const [source, rule] of snippets) {
        const [result] = await eslint.lintText(source, { filePath: path.join(root, 'src/types/domain.ts') });
        assert.ok(result.messages.some(message => message.ruleId === rule && message.severity === 2), rule);
    }
    const [safe] = await eslint.lintText('export function value(input: unknown): string { return typeof input === "string" ? input : ""; }', {filePath: path.join(root, 'src/types/domain.ts')});
    assert.equal(safe.errorCount, 0);
    assert.equal(safe.warningCount, 0);
});

test('the actual compiler configuration rejects implicit any and unsafe null access', () => {
    const configFile = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
    assert.equal(configFile.error, undefined);
    const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
    assert.equal(config.options.strict, true);
    assert.equal(config.options.noImplicitAny, true);
    const fileName = path.join(root, 'src/types/compiler-policy-probe.ts');
    const source = 'export const untyped = input => input; export function nullable(input: string | null) { return input.length; }';
    const host = ts.createCompilerHost(config.options);
    const originalSource = host.getSourceFile;
    host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) => name === fileName ? ts.createSourceFile(name, source, languageVersion, true) : originalSource(name, languageVersion, onError, shouldCreateNewSourceFile);
    const program = ts.createProgram([fileName], config.options, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.ok(diagnostics.some(diagnostic => diagnostic.code === 7006), 'implicit any must fail');
    assert.ok(diagnostics.some(diagnostic => diagnostic.code === 18047), 'nullable property access must fail');
});
