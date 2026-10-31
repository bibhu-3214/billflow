const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
    testDir: './accessibility', testMatch: '*.spec.cjs', workers: 1, timeout: 180000,
    use: { baseURL: 'http://127.0.0.1:3300', channel: process.env.PLAYWRIGHT_CHANNEL || undefined, reducedMotion: 'reduce', trace: 'retain-on-failure' },
    webServer: {
        command: 'REACT_APP_ACCOUNT_BACKEND=local npm exec vite -- --host 127.0.0.1 --port 3300 --strictPort',
        url: 'http://127.0.0.1:3300', reuseExistingServer: false,
    },
    outputDir: 'output/accessibility-results', reporter: 'list',
});
