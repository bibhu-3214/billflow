const { test, expect } = require('@playwright/test');

for (const hostname of ['127.0.0.1', 'localhost']) {
    test(hostname + ': local proxy preserves CSRF origin and token validation', async ({ playwright, baseURL }) => {
        const origin = new URL(baseURL || 'http://127.0.0.1:3000');
        test.skip(!['127.0.0.1', 'localhost'].includes(origin.hostname), 'Loopback development proxy check.');
        origin.hostname = hostname;
        const client = await playwright.request.newContext({ baseURL: origin.origin });
        try {
            const configResponse = await client.get('/api/v1/config');
            expect(configResponse.status()).toBe(200);
            const config = await configResponse.json();
            expect(config.csrfToken).toBeTruthy();
            const endpoint = '/_allauth/browser/v1/auth/login';
            // Empty credentials must reach form validation, without logging into or changing an account.
            const validation = await client.post(endpoint, {
                headers: { Origin: origin.origin, 'X-CSRFToken': config.csrfToken }, data: {},
            });
            expect(validation.status()).toBe(400);
            const foreignOrigin = await client.post(endpoint, {
                headers: { Origin: 'https://foreign-origin.invalid', 'X-CSRFToken': config.csrfToken }, data: {},
            });
            expect(foreignOrigin.status()).toBe(403);
            const missingToken = await client.post(endpoint, {
                headers: { Origin: origin.origin }, data: {},
            });
            expect(missingToken.status()).toBe(403);
        } finally { await client.dispose(); }
    });
}
