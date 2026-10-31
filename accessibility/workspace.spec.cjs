const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
async function check(page) {
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
test('public forms and sample billing workspace meet automated accessibility checks', async ({ page }) => {
    const errors = [];
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const path of ['/login', '/register']) { await page.goto(path); await check(page); }
    }
    // Browser-scoped fictional data: this suite never signs into the connected API.
    await page.goto('/');
    await page.getByRole('button', { name: 'Explore live demo', exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    for (const theme of ['light', 'dark']) {
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 1000 });
            for (const path of ['/admin', '/billing', '/customer-insights']) {
                await page.goto(path);
                await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
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
