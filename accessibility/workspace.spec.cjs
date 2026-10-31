const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
async function check(page) {
    await page.locator("#main-content").waitFor();
    await page.locator('[aria-busy="true"]').waitFor({ state: 'hidden' });
    await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
    });
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    if (violations.length) await test.info().attach('accessibility-details', { body: JSON.stringify(violations, null, 2), contentType: 'application/json' });
    expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
test('public forms and sample billing workspace meet automated accessibility checks', async ({ page }) => {
    const errors = [];
    page.setDefaultTimeout(10000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const path of ['/login', '/register']) { await page.goto(path); await check(page); }
    }
    // Browser-scoped fictional data: this suite never signs into the connected API.
    await page.goto('/');
    await page.getByRole('button', { name: 'Explore live demo', exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await check(page);
    for (const theme of ['light', 'dark']) {
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 1000 });
            for (const path of ['/admin', '/billing', '/customer-insights']) {
                await page.goto(path);
                await expect(page.getByRole('main')).toBeVisible();
                if (await page.locator('html').getAttribute('data-theme') !== theme)
                    await page.getByRole('button', { name: `Switch to ${theme} mode`, exact: true }).click();
                await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
                await check(page);
            }
        }
    }
    const trigger = page.getByRole('button', { name: 'Search workspace', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    expect(violations.map(({ id }) => id)).toEqual([]);
    for (let i = 0; i < 18; i++) {
        await page.keyboard.press('Tab');
        expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(errors).toEqual([]);
});

test('new workspaces see real setup progress and the next useful action', async ({page}) => {
    page.setDefaultTimeout(10000);
    const email='polish-'+Date.now()+'@example.test';
    await page.goto('/register');
    await page.getByLabel('Your name', {exact:true}).fill('Polish Owner');
    await page.getByLabel('Work email', {exact:true}).fill(email);
    await page.getByLabel('Password', {exact:true}).fill('BrowserOnly#4827');
    await page.getByLabel('Business name', {exact:true}).fill('Polish fixture');
    await page.getByLabel('Business address', {exact:true}).fill('Mumbai');
    await page.getByRole('button', {name:'Create workspace',exact:true}).click();
    await page.getByRole('button', {name:'OK',exact:true}).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Work email', {exact:true}).fill(email);
    await page.getByLabel('Password', {exact:true}).fill('BrowserOnly#4827');
    await page.getByRole('button', {name:'Open workspace',exact:true}).click();
    await page.getByRole('button', {name:'OK',exact:true}).click();
    await expect(page.getByRole('progressbar', {name:'Billing workspace setup'})).toHaveAttribute('aria-valuenow','1');
    await page.getByRole('link', {name:'Add your first customer',exact:true}).click();
    await expect(page).toHaveURL(/\/customer$/);
});
