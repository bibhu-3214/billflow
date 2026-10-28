const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({ testDir: './tests', testMatch: '**/*.spec.cjs', workers: 1, timeout: 45000,
    use: { baseURL: process.env.BILLFLOW_TEST_ORIGIN || 'http://127.0.0.1:3000', browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || undefined, trace: 'retain-on-failure' },
    outputDir: 'output/browser-results', reporter: 'list' });
