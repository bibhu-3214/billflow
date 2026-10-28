const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');

test('the test DOM handles international hosts without Node deprecations', () => {
    const output = execFileSync(process.execPath, ['--throw-deprecation', '-e',
        'const { JSDOM } = require("jsdom"); process.stdout.write(new JSDOM("", { url: "https://mañana.com" }).window.location.hostname);',
    ], { encoding: 'utf8' });
    assert.equal(output, 'xn--maana-pta.com');
});
