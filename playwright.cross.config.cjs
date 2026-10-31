const { defineConfig, devices } = require('@playwright/test');
const accessibility = require('./playwright.accessibility.config.cjs');
module.exports = defineConfig(accessibility, {
    workers: 1,
    projects: [
        { name: 'firefox', use: { ...devices['Desktop Firefox'], channel: undefined } },
        { name: 'webkit', use: { ...devices['Desktop Safari'], channel: undefined } },
        { name: 'mobile-safari', use: { ...devices['iPhone 14'], channel: undefined } },
    ],
});
