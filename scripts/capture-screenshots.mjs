// Captures matching screenshots of the legacy site and the React app for visual comparison
// (migration plan Phase 0 step 3 / Phase 7 step 2).
// Usage: node scripts/capture-screenshots.mjs [legacy|app|both]   (app expects `npm run preview` on :4173)
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(import.meta.dirname, '..');
const outDir = join(root, 'fixtures', 'screenshots');
mkdirSync(outDir, { recursive: true });
const which = process.argv[2] ?? 'both';

const viewports = { desktop: { width: 1280, height: 900 }, mobile: { width: 390, height: 844 } };

async function legacy(page, vp) {
  const url = pathToFileURL(join(root, 'legacy', 'index.html')).href;
  await page.goto(url);
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(outDir, `legacy-${vp}-apartments.png`), fullPage: false });
  await page.click('.hs[data-b="B4"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, `legacy-${vp}-building.png`), fullPage: false });
  await page.click('#cards .card');
  for (const [t, name] of [
    ['ins', 'insights'],
    ['bld', 'building'],
    ['3d', 'schematic'],
  ]) {
    await page.click(`.ptab[data-t="${t}"]`);
    await page.waitForTimeout(t === '3d' ? 1500 : 300);
    await page.screenshot({ path: join(outDir, `legacy-${vp}-sheet-${name}.png`) });
  }
  await page.keyboard.press('Escape');
  await page.click('#tabPrio');
  await page.screenshot({ path: join(outDir, `legacy-${vp}-my-list.png`) });
  await page.click('#tabData');
  await page.screenshot({ path: join(outDir, `legacy-${vp}-data.png`) });
}

async function app(page, vp) {
  await page.goto('http://localhost:4173/');
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(outDir, `app-${vp}-apartments.png`), fullPage: false });
  await page.click('[data-building="B4"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, `app-${vp}-building.png`), fullPage: false });
  await page.locator('article a').first().click();
  for (const name of ['insights', 'building', 'schematic']) {
    await page
      .getByRole('tab', {
        name: { insights: 'תובנות', building: 'הבניין והקומה', schematic: 'הדמיה סכמטית' }[name],
      })
      .click();
    await page.waitForTimeout(name === 'schematic' ? 1500 : 300);
    await page.screenshot({ path: join(outDir, `app-${vp}-sheet-${name}.png`) });
  }
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: /הרשימה שלי/ }).click();
  await page.screenshot({ path: join(outDir, `app-${vp}-my-list.png`) });
  await page.getByRole('link', { name: 'נתונים' }).click();
  await page.screenshot({ path: join(outDir, `app-${vp}-data.png`) });
}

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
for (const [vp, viewport] of Object.entries(viewports)) {
  const ctx = await browser.newContext({ viewport, locale: 'he-IL', colorScheme: 'light' });
  if (which !== 'app') await legacy(await ctx.newPage(), vp);
  if (which !== 'legacy') await app(await ctx.newPage(), vp);
  await ctx.close();
}
await browser.close();
console.log('screenshots in', outDir);
