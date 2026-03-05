import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();
  const dir = '/tmp/mobile-screenshots';

  console.log('1. Navigating to localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${dir}/01-initial-load.png`, fullPage: true });
  console.log('  -> 01-initial-load.png saved');

  // 2. Click canvas tab
  console.log('2. Clicking canvas tab...');
  const canvasBtn = page.getByRole('button', { name: '캔버스' });
  if (await canvasBtn.isVisible()) {
    await canvasBtn.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: `${dir}/02-canvas-tab.png`, fullPage: true });
  console.log('  -> 02-canvas-tab.png saved');

  // 3. Open sidebar
  console.log('3. Opening sidebar...');
  const menuBtn = page.getByLabel('Toggle sidebar');
  if (await menuBtn.isVisible()) {
    await menuBtn.click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: `${dir}/03-sidebar-open.png`, fullPage: true });
  console.log('  -> 03-sidebar-open.png saved');

  // 4. Close sidebar
  console.log('4. Closing sidebar...');
  const backdrop = page.locator('div.fixed').filter({ hasText: '' }).first();
  try {
    await page.locator('[aria-label="사이드바 닫기"]').click({ timeout: 2000 });
  } catch {
    try {
      await backdrop.click({ timeout: 2000 });
    } catch {
      console.log('  Could not close sidebar');
    }
  }
  await page.waitForTimeout(500);

  // 5. Command palette
  console.log('5. Opening command palette...');
  await page.keyboard.press('Meta+k');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/04-command-palette.png`, fullPage: true });
  console.log('  -> 04-command-palette.png saved');

  // 6. Close palette and go to dashboard
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const dashBtn = page.getByRole('button', { name: '대시보드' });
  if (await dashBtn.isVisible()) {
    await dashBtn.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: `${dir}/05-dashboard.png`, fullPage: true });
  console.log('  -> 05-dashboard.png saved');

  // 7. Check header specifically - take a cropped screenshot
  console.log('6. Header close-up...');
  const header = page.locator('header');
  if (await header.isVisible()) {
    await header.screenshot({ path: `${dir}/06-header-closeup.png` });
    console.log('  -> 06-header-closeup.png saved');
  }

  await browser.close();
  console.log('Done!');
})();
