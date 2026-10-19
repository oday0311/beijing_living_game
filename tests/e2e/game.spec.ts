import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function assertLayout(page: Page) {
  const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width);
  const overflowingButtons = await page.locator('button:visible').evaluateAll((buttons) => buttons
    .filter((button) => button.scrollWidth > button.clientWidth + 2 && !button.classList.contains('subway-station'))
    .map((button) => button.getAttribute('aria-label') || button.textContent?.trim()));
  expect(overflowingButtons).toEqual([]);
  const lastRow = page.getByRole('table', { name: '今日行情' }).locator('tbody tr').last();
  if (await lastRow.isVisible()) {
    await lastRow.evaluate((row) => {
      const bar = document.querySelector('.desk-actionbar')!.getBoundingClientRect();
      window.scrollBy(0, row.getBoundingClientRect().bottom - bar.top + 20);
    });
    const row = await lastRow.boundingBox();
    const bar = await page.locator('.desk-actionbar').boundingBox();
    if (row && row.y < page.viewportSize()!.height) expect(row.y + row.height).toBeLessThanOrEqual(bar!.y + 1);
  }
}

async function acknowledgeEvents(page: Page) {
  while (await page.getByRole('dialog').filter({ has: page.locator('.event-art') }).count()) {
    const art = page.locator('.event-art');
    await expect.poll(() => art.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await page.getByRole('button', { name: '知道了' }).click();
  }
}

async function showTab(page: Page, name: string) {
  const tab = page.getByRole('tab', { name });
  if (await tab.isVisible()) await tab.click();
}

async function travel(page: Page) {
  await showTab(page, '城市');
  await page.locator('.subway-station:not([disabled])').first().click();
  await page.getByRole('button', { name: '确认换站' }).click();
  await acknowledgeEvents(page);
}

for (const mode of ['classic', 'modern'] as const) {
  test(`${mode} game survives reload, trades and reaches settlement`, async ({ page }, testInfo) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('/');
    await page.getByRole('button', { name: mode === 'classic' ? '经典模式' : '新北京模式' }).click();
    await page.getByLabel('角色姓名').fill(`${mode}测试玩家`);
    if (mode === 'modern') await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: '开始游戏' }).click();
    await expect(page.getByRole('heading', { name: new RegExp(`${mode}测试玩家的北京日程`) })).toBeVisible();
    await acknowledgeEvents(page);
    await assertLayout(page);
    await page.screenshot({ path: `test-results/${mode}-${testInfo.project.name}-board.png`, fullPage: true });

    await page.reload();
    await page.getByRole('button', { name: '继续游戏' }).click();
    await expect(page.getByRole('heading', { name: new RegExp(`${mode}测试玩家的北京日程`) })).toBeVisible();
    await acknowledgeEvents(page);
    if (mode === 'classic') await travel(page);
    await showTab(page, '行情');
    await page.getByRole('table', { name: '今日行情' }).getByRole('row', { name: mode === 'classic' ? /盗版VCD/ : /咖啡豆/ }).click();
    await page.getByRole('button', { name: '买进' }).click();
    await page.getByRole('dialog', { name: /买进/ }).getByRole('button', { name: '确认买进' }).click();
    await expect(page.getByRole('button', { name: '卖出' })).toBeEnabled();
    await page.getByRole('button', { name: '卖出' }).click();
    await page.getByRole('dialog', { name: /卖出/ }).getByRole('button', { name: '确认卖出' }).click();
    await page.getByRole('button', { name: mode === 'modern' ? '借款' : '还债' }).click();
    await page.getByRole('button', { name: mode === 'modern' ? '确认借款' : '确认还债' }).click();
    if (mode === 'modern') await travel(page);
    await expect(page.getByText(/第 2 \/ 40 天/)).toBeVisible();
    await assertLayout(page);

    await page.evaluate(() => (window as Window & { __beijingTest?: { advanceToDay39: () => void } }).__beijingTest?.advanceToDay39());
    await expect(page.getByText(/第 39 \/ 40 天/)).toBeVisible();
    await travel(page);
    await expect(page.getByRole('dialog', { name: '本局结算' })).toBeVisible();
    await page.screenshot({ path: `test-results/${mode}-${testInfo.project.name}-settlement.png` });
    await page.getByRole('dialog', { name: '本局结算' }).getByRole('button', { name: '返回入口' }).click();
    await page.getByRole('button', { name: '本地排行榜' }).click();
    await page.getByRole('tab', { name: mode === 'classic' ? '经典模式' : '新北京模式' }).click();
    await expect(page.getByText(`${mode}测试玩家`)).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('settings survive reload and an exported save can be restored after reset', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('角色姓名').fill('存档玩家');
  await page.getByRole('button', { name: '开始游戏' }).click();
  await page.getByRole('button', { name: '设置' }).click();
  const settings = page.getByRole('dialog', { name: '设置' });
  await settings.getByRole('checkbox', { name: '音效' }).uncheck();
  const downloadPromise = page.waitForEvent('download');
  await settings.getByRole('button', { name: '导出存档' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const exportPath = await download.path();
  expect(exportPath).not.toBeNull();
  await settings.getByRole('button', { name: '重置本局' }).click();
  await settings.getByRole('button', { name: '确认重置' }).click();
  await expect(page.getByLabel('角色姓名')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '设置' }).click();
  await expect(page.getByRole('dialog', { name: '设置' }).getByRole('checkbox', { name: '音效' })).not.toBeChecked();
  await page.getByLabel('选择存档文件', { exact: true }).setInputFiles(exportPath!);
  await page.getByRole('button', { name: '确认导入' }).click();
  await expect(page.getByRole('heading', { name: '存档玩家的北京日程' })).toBeVisible();
});
