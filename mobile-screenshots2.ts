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
  const API = 'http://localhost:3000/api';

  // Clean and create test data
  await fetch(`${API}/test/cleanup`, { method: 'POST' });

  // Create a project
  const projRes = await fetch(`${API}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'My Project', slug: 'my-project', projectDir: '/tmp/test' }),
  });
  const { data: proj } = await projRes.json();

  // Create some nodes
  const nodeTypes = ['task', 'idea', 'decision', 'issue'];
  const titles = ['API 설계', '새로운 아이디어', 'DB 선택', '버그 수정'];
  for (let i = 0; i < 4; i++) {
    await fetch(`${API}/projects/${proj.id}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: nodeTypes[i],
        title: titles[i],
        status: i === 0 ? 'in_progress' : i === 1 ? 'todo' : 'backlog',
        canvasX: 100 + (i % 2) * 300,
        canvasY: 100 + Math.floor(i / 2) * 200,
      }),
    });
  }

  // Create an edge
  const nodesRes = await fetch(`${API}/projects/${proj.id}/nodes`);
  const { data: nodes } = await nodesRes.json();
  if (nodes.length >= 2) {
    await fetch(`${API}/edges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromNodeId: nodes[0].id, toNodeId: nodes[1].id, type: 'sequence' }),
    });
  }

  console.log('Test data created. Taking screenshots...');

  // 1. Dashboard with data
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${dir}/10-dashboard-with-data.png`, fullPage: true });
  console.log('10-dashboard-with-data.png');

  // 2. Canvas with nodes
  const canvasBtn = page.getByRole('button', { name: '캔버스' });
  if (await canvasBtn.isVisible()) {
    await canvasBtn.click();
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: `${dir}/11-canvas-with-nodes.png`, fullPage: true });
  console.log('11-canvas-with-nodes.png');

  // 3. Click a node to open side panel
  const nodeEl = page.locator('[data-testid="rf__node-"]').first();
  const anyNode = page.locator('.react-flow__node').first();
  try {
    if (await anyNode.isVisible({ timeout: 3000 })) {
      await anyNode.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${dir}/12-side-panel-open.png`, fullPage: true });
      console.log('12-side-panel-open.png');
    } else {
      console.log('No nodes visible on canvas');
      await page.screenshot({ path: `${dir}/12-no-nodes-found.png`, fullPage: true });
    }
  } catch (e) {
    console.log('Could not click node:', e);
    await page.screenshot({ path: `${dir}/12-error.png`, fullPage: true });
  }

  // 4. Try the FAB button
  const fabBtn = page.locator('button[aria-label="노드 추가"]');
  if (await fabBtn.isVisible({ timeout: 2000 })) {
    // Close panel first
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await fabBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/13-fab-menu-open.png`, fullPage: true });
    console.log('13-fab-menu-open.png');
  }

  // 5. Check the "1 error" - look at console errors
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Check what the error overlay says
  const errorOverlay = page.locator('text=error').first();
  if (await errorOverlay.isVisible({ timeout: 2000 })) {
    await errorOverlay.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${dir}/14-error-detail.png`, fullPage: true });
    console.log('14-error-detail.png');
  }

  await browser.close();
  console.log('Done!');
})();
