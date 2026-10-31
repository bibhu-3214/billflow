const {test,expect}=require('@playwright/test');
test('recurring plans prepare a reviewable draft without issuing an invoice',async({page},testInfo)=>{
 page.setDefaultTimeout(10000);
 await page.goto('/');await page.getByRole('button',{name:'Explore live demo',exact:true}).click();await expect(page).toHaveURL(/\/admin$/);
 await page.locator('#main-content [aria-busy="true"]').waitFor({state:'hidden'});
 await page.goto('/billing');await expect(page.locator('tbody tr').first()).toBeVisible();const count=await page.locator('tbody tr').count();
 await page.getByRole('link',{name:'Recurring plans',exact:true}).click();await page.getByRole('button',{name:'New recurring plan',exact:true}).click();
 await page.getByLabel('Plan name').fill('Monthly service');await page.getByRole('button',{name:'Save recurring plan',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Create recurring plan',exact:true})).not.toBeVisible();
 await page.getByRole('button',{name:'Prepare next draft',exact:true}).click();const review=page.getByRole('dialog',{name:'Prepare recurring invoice draft?',exact:true});await expect(review).toContainText('current catalogue prices');
 await review.getByRole('button',{name:'Prepare draft',exact:true}).click();await expect(page.getByRole('heading',{name:'Resume invoice draft',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('heading',{name:'Resume invoice draft',exact:true})).not.toBeVisible();
 await expect(page.getByRole('button',{name:'Prepare next draft',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Resume latest draft',exact:true}).click();await expect(page.getByRole('heading',{name:'Resume invoice draft',exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.getByRole('region',{name:'Recurring invoice plans'}).scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('recurring-plans-phone.png')});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.getByRole('link',{name:'Issued invoices',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(count);
});
