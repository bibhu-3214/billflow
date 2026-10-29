const { test, expect } = require('@playwright/test');
const crypto = require('node:crypto');

test.describe.configure({ mode: 'serial' });
async function login(page, name) {
    await page.goto('/login');
    await page.getByLabel('Work email').fill('acceptance-' + name + '@example.test');
    await page.getByLabel('Password', { exact: true }).fill('AcceptanceOnly#4827');
    await page.getByRole('button', { name: 'Open workspace', exact: true }).click();
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
}
async function command(page, action, args) {
    const key = crypto.randomUUID();
    return page.evaluate(async ({ action, args, key }) => {
        const config = await (await fetch('/api/v1/config')).json();
        const response = await fetch('/api/v1/actions/' + action, { method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': config.csrfToken, 'Idempotency-Key': key },
            body: JSON.stringify({ args }) });
        const value = await response.json();
        if (!response.ok) throw new Error(JSON.stringify(value));
        return value;
    }, { action, args, key });
}
for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet', 820, 1180], ['phone', 390, 844]]) {
    test(name + ': connected draft, invoice, payment, backup and sign-out', async ({ page }) => {
        await page.setViewportSize({ width, height });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await login(page, name);
        const customer = await command(page, 'addCustomer', [{ name: 'Buyer ' + name + ' ' + crypto.randomUUID().slice(0, 6), email: name + '@example.test', mobile: '9876543210', address: 'Mumbai' }]);
        const product = await command(page, 'addProduct', [{ name: 'Service ' + name + ' ' + crypto.randomUUID().slice(0, 6), price: 100, unit: 'HRS' }]);
        await page.goto('/billing');
        await page.getByRole('button', { name: 'Create invoice', exact: true }).click();
        const dialog = page.getByRole('dialog');
        const reference = 'Acceptance ' + name + ' ' + crypto.randomUUID().slice(0, 8);
        await dialog.locator('#invoice-draft-title').fill(reference);
        await dialog.locator('#invoice-customer').selectOption(customer._id);
        await dialog.locator('#invoice-product').selectOption(product._id);
        await dialog.getByRole('button', { name: 'Add', exact: true }).click();
        await dialog.getByRole('button', { name: 'Save draft', exact: true }).click();
        await expect(dialog).not.toBeVisible();
        await expect(page.getByText(reference, { exact: true })).toBeVisible();
        await page.reload();
        const draftCard = page.locator('.draft-card').filter({ hasText: reference });
        await draftCard.getByRole('button', { name: /resume/i }).click();
        await dialog.getByRole('button', { name: 'Issue invoice', exact: true }).click();
        await expect(page).toHaveURL(/\/billdetails\/invoice_/);
        await expect(page.getByText('Balance due', { exact: true })).toBeVisible();
        await page.getByLabel('Amount received (₹)').fill('25');
        await page.getByRole('button', { name: 'Record payment', exact: true }).click();
        await expect(page.getByText('INR 75.00', { exact: true }).first()).toBeVisible();
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ animations: 'disabled', path: 'output/connected-' + name + '-invoice.png', fullPage: true });
        await page.goto('/settings');
        await expect(page.getByRole('heading', { name: 'Move your existing business here.' })).toBeVisible();
        await page.getByLabel('Backup password', { exact: true }).fill('PrivateBackup#4837');
        await page.getByLabel('Confirm backup password').fill('PrivateBackup#4837');
        const downloading = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download encrypted backup' }).click();
        const download = await downloading;
        await download.saveAs('output/' + name + '-encrypted-backup.json');
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ animations: 'disabled', path: 'output/connected-' + name + '-settings.png', fullPage: true });
        await page.goto('/help');
        await expect(page.getByRole('heading', { name: 'A little help, when you need it.' })).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        expect(overflow).toBe(false);
        await page.getByRole('button', { name: 'Sign out', exact: true }).click();
        await page.getByRole('button', { name: 'OK', exact: true }).click();
        await expect(page).toHaveURL(/\/$/);
        await page.goto('/admin');
        await expect(page).toHaveURL(/\/login$/);
        expect(errors).toEqual([]);
    });
}
