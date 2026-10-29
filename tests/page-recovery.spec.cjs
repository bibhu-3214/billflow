const {test,expect}=require('@playwright/test');

test('production page download failure keeps navigation and recovery available',async({page})=>{
    const origin=process.env.BILLFLOW_TEST_BUILT_ORIGIN;
    test.skip(!origin,'Set BILLFLOW_TEST_BUILT_ORIGIN to a connected production preview.');
    await page.route('**/assets/Admin-*.js',route=>route.abort());
    await page.goto(origin+'/login');
    await page.getByLabel('Work email').fill('acceptance@example.test');
    await page.getByLabel('Password',{exact:true}).fill('AcceptanceOnly#4827');
    await page.getByRole('button',{name:'Open workspace',exact:true}).click();
    await page.getByRole('button',{name:'OK',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('This page couldn’t open.');
    await expect(page.getByRole('button',{name:'Reload page',exact:true})).toBeVisible();
    await page.getByRole('link',{name:'Products',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Product catalog',exact:true})).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.screenshot({path:'output/premium-production-recovery.png',animations:'disabled'});
});
