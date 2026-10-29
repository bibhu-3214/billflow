const {test,expect}=require('@playwright/test');
test.use({colorScheme:'light'});
for(const [name,width,height] of [['desktop',1440,1000],['tablet',820,1180],['phone',390,844]]) {
    test(name+': overview interactions, direct invoice entry and focused sales views',async({page})=>{
        await page.setViewportSize({width,height});
        const errors=[];page.on('pageerror',error=>errors.push(error.message));
        await page.goto('/login');await page.getByLabel('Work email').fill('acceptance-'+name+'@example.test');await page.getByLabel('Password',{exact:true}).fill('AcceptanceOnly#4827');
        await page.getByRole('button',{name:'Open workspace',exact:true}).click();await page.getByRole('button',{name:'OK',exact:true}).click();await expect(page).toHaveURL(/\/admin$/);
        await expect(page.getByRole('heading',{name:'Your business, at a glance.'})).toBeVisible();
        await expect(page.getByText('Stored on this browser')).toHaveCount(0);
        await expect(page.getByRole('link',{name:'Statements',exact:true})).toBeAttached();
        await page.getByRole('combobox',{name:'Chart period'}).click();await page.getByRole('option',{name:'Last 12 months',exact:true}).click();
        const months=page.getByRole('group',{name:'Monthly invoice values'}).getByRole('button');
        await expect(months).toHaveCount(12);await months.first().click();await expect(months.first()).toHaveAttribute('aria-pressed','true');
        await page.getByText('View monthly figures',{exact:true}).click();await expect(page.getByRole('table',{name:'Invoice value by month, including tax'})).toBeVisible();
        await page.getByText('View monthly figures',{exact:true}).click();
        await page.getByRole('combobox',{name:'Chart period'}).click();await page.getByRole('option',{name:'Last 6 months',exact:true}).click();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
        await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'output/premium-'+name+'-overview-light.png',fullPage:true,animations:'disabled'});
        await page.getByRole('button',{name:'Switch to dark mode'}).click();await page.waitForTimeout(250);
        await page.screenshot({path:'output/premium-'+name+'-overview-dark.png',fullPage:true,animations:'disabled'});
        await page.getByRole('link',{name:'Create invoice',exact:true}).click();
        const studio=page.getByRole('dialog',{name:'Invoice studio'});await expect(studio).toBeVisible();await expect(page).not.toHaveURL(/compose=/);
        await page.keyboard.press('Escape');await expect(studio).not.toBeVisible();await expect(page.getByRole('button',{name:'Create invoice',exact:true})).toBeFocused();
        await page.getByRole('link',{name:'Saved drafts',exact:true}).click();await expect(page).toHaveURL(/view=drafts/);
        await page.reload();await expect(page.getByRole('link',{name:'Saved drafts',exact:true})).toHaveAttribute('aria-current','page');
        await expect(page.getByRole('group',{name:'Filter invoice status'})).toHaveCount(0);
        await page.getByRole('link',{name:'Offers & templates',exact:true}).click();await expect(page.getByRole('heading',{name:'Sales preparation'})).toBeVisible();
        await page.getByRole('link',{name:'Issued invoices',exact:true}).click();await expect(page.getByRole('group',{name:'Filter invoice status'})).toBeVisible();
        await page.screenshot({path:'output/premium-'+name+'-sales-dark.png',fullPage:true,animations:'disabled'});
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
    });
}

test('empty overview uses real zero figures and guides first billing setup',async({page})=>{
    await page.goto('/login');await page.getByLabel('Work email').fill('acceptance@example.test');await page.getByLabel('Password',{exact:true}).fill('AcceptanceOnly#4827');
    await page.getByRole('button',{name:'Open workspace',exact:true}).click();await page.getByRole('button',{name:'OK',exact:true}).click();await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText('0 saved customers',{exact:true})).toBeVisible();await expect(page.getByText('0 items available for billing',{exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Your first sale starts here.'})).toBeVisible();
    await expect(page.getByRole('article').filter({has:page.getByText('Total invoiced',{exact:true})})).toContainText('₹0.00');
    await page.getByText('Stock & customer follow-ups',{exact:true}).click();await expect(page.getByRole('heading',{name:'Stock needing attention'})).toBeVisible();
});
