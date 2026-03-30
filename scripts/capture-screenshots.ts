import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const OUT = "docs/screenshots";

async function setReactInput(page: any, selector: string, value: string) {
  await page.evaluate(
    ({ sel, val }: { sel: string; val: string }) => {
      const el = document.querySelector(sel) as HTMLInputElement;
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      nativeSetter?.call(el, val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { sel: selector, val: value }
  );
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Login
  await page.goto(`${BASE}/login`);
  await page.waitForSelector("#email");
  await setReactInput(page, "#email", process.env.TTR_EMAIL ?? "");
  await setReactInput(page, "#password", process.env.TTR_PASSWORD ?? "");
  await page.click('button[type="submit"]');
  await page.waitForURL((url: URL) => !url.pathname.includes("/login"), {
    timeout: 15000,
  });
  await page.waitForTimeout(3000);

  // 1. Dashboard (already captured but recapture for consistency)
  console.log("Capturing dashboard...");
  await page.screenshot({ path: `${OUT}/dashboard.png` });

  // 2. Canvas
  console.log("Capturing canvas...");
  await page.keyboard.press("Meta+2");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/canvas.png` });

  // 3. Side panel - force click on node to bypass intercept
  console.log("Capturing side panel...");
  const node = page.locator(".react-flow__node").first();
  if ((await node.count()) > 0) {
    await node.click({ force: true, timeout: 5000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/side-panel.png` });
  }

  // 4. Command palette
  console.log("Capturing command palette...");
  // Close panel first if open
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await page.keyboard.press("Meta+k");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/command-palette.png` });

  await browser.close();
  console.log("Done!");
}

main().catch(console.error);
