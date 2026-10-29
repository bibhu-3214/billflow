const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
test.use({colorScheme:'light'});

for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet', 820, 1180], ['phone', 390, 844]]) {
    test(name + ': appearance, keyboard dialogs and printable quotation', async ({ page }) => {
        await page.setViewportSize({ width, height });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('/login');
        await page.getByLabel('Work email').fill('acceptance-' + name + '@example.test');
        await page.getByLabel('Password', { exact: true }).fill('AcceptanceOnly#4827');
        await page.getByRole('button', {name: 'Open workspace', exact: true}).click();
        await page.getByRole('button', {name: 'OK', exact: true}).click();
        await expect(page).toHaveURL(/\/admin$/);
        const themeToggle = page.getByRole('button', {name: 'Switch to dark mode'});
        await themeToggle.hover();
        const tooltip = await page.getByRole('tooltip', {name:'Switch to dark mode'}).boundingBox();
        expect(tooltip.y).toBeGreaterThanOrEqual(0);
        expect(tooltip.x).toBeGreaterThanOrEqual(0);
        expect(tooltip.x + tooltip.width).toBeLessThanOrEqual(width);
        await themeToggle.click();
        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        for (const route of ['/admin', '/customer', '/product', '/receivables', '/statements', '/settings', '/help', '/billing']) {
            await page.goto(route);
            await page.waitForTimeout(350); // Wait for entrance transitions before measuring layout.
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), route).toBe(true);
        }
        const trigger = page.getByRole('button', {name: 'Create invoice', exact: true});
        await trigger.click();
        const studio = page.getByRole('dialog', {name: 'Invoice studio'});
        await expect(studio).toHaveAttribute('aria-modal', 'true');
        const bounds = await studio.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(11);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 11);
        await studio.getByLabel('Draft reference (internal only)').fill('Unsaved keyboard fixture');
        for (let i = 0; i < 25; i++) {
            await page.keyboard.press('Tab');
            expect(await studio.evaluate(e => e.contains(document.activeElement))).toBe(true);
        }
        await page.keyboard.press('Escape');
        const confirmation = page.getByRole('dialog', {name: 'Discard unsaved changes?'});
        await expect(confirmation).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(confirmation).not.toBeVisible();
        await expect(studio.getByLabel('Draft reference (internal only)')).toHaveValue('Unsaved keyboard fixture');
        await page.keyboard.press('Escape');
        await confirmation.getByRole('button', {name: 'Discard changes', exact: true}).click();
        await expect(studio).not.toBeVisible();
        await expect(trigger).toBeFocused();

        const title = 'Tailwind offer ' + randomUUID().slice(0, 8);
        await page.getByRole('button', {name: 'Create quotation', exact: true}).click();
        const quoteStudio = page.getByRole('dialog', {name: 'Quotation studio'});
        await quoteStudio.getByLabel('Offer title', {exact:true}).fill(title);
        // These accounts are populated by connected.spec.cjs, or seed a fresh isolated fixture.
        const fixture = await page.evaluate(async key => {
            const config = await (await fetch('/api/v1/config')).json();
            const action = async (name, args) => {
                const response = await fetch('/api/v1/actions/' + name, {method:'POST', headers:{'Content-Type':'application/json','X-CSRFToken':config.csrfToken,'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({args})});
                const value = await response.json(); if (!response.ok) throw new Error(JSON.stringify(value)); return value;
            };
            return {customer:await action('addCustomer',[{name:'Interface buyer '+key,email:'fixture@example.test',mobile:'9876543210',address:'Mumbai'}]),product:await action('addProduct',[{name:'Interface service '+key,price:100,unit:'HRS'}])};
        }, randomUUID().slice(0,8));
        // Reloading would lose the dirty editor; close and reopen to refresh catalog state.
        await page.keyboard.press('Escape');
        await page.getByRole('button', {name:'Discard changes',exact:true}).click();
        await page.reload();
        await page.getByRole('button', {name: 'Create quotation', exact: true}).click();
        await quoteStudio.getByLabel('Offer title', {exact:true}).fill(title);
        await quoteStudio.locator('#invoice-customer').click();
        await page.getByRole('option',{name:new RegExp(fixture.customer.name)}).click();
        await quoteStudio.locator('#invoice-product').click();
        await page.getByRole('option',{name:new RegExp(fixture.product.name)}).click();
        await quoteStudio.getByRole('button',{name:'Add',exact:true}).click();
        await quoteStudio.screenshot({path:'output/tailwind-'+name+'-composer-dark.png',animations:'disabled'});
        await quoteStudio.getByRole('button',{name:'Save quotation',exact:true}).click();
        await expect(quoteStudio).not.toBeVisible();
        await page.getByRole('button',{name:'Review '+title,exact:true}).click();
        const review = page.getByRole('dialog',{name:'Quotation review'});
        await expect(review.locator('.quotation-print')).toHaveCSS('background-color','rgb(255, 255, 255)');
        await expect(review.locator('.quotation-print')).toHaveCSS('color','rgb(23, 32, 51)');
        if (name === 'desktop') {
            await page.emulateMedia({media:'print'});
            await expect(page.locator('#root')).toBeHidden();
            await expect(page.locator('.quote-actions')).toBeHidden();
            await expect(page.locator('.quotation-print')).toBeVisible();
            await expect(page.locator('.ui-dialog-panel:has(.quotation-print)')).toHaveCSS('opacity','1');
            await page.pdf({path:'output/tailwind-quotation-print.pdf',format:'A4',printBackground:true});
            await page.emulateMedia({media:'screen'});
        }
        await review.getByRole('button',{name:'Close',exact:true}).click();
        await page.getByRole('button',{name:'Switch to light mode'}).click();
        await page.waitForTimeout(350);
        await page.screenshot({path:'output/tailwind-'+name+'-billing-light.png',fullPage:true,animations:'disabled'});
        expect(errors).toEqual([]);
    });
}
