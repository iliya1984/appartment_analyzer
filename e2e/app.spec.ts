import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import * as XLSX from 'xlsx';

const firstCardLink = (page: Page) => page.locator('article a').first();

test.describe('navigation and views', () => {
  test('loads with no requests to other hosts (works offline after first load)', async ({
    page,
  }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith('http://localhost')) external.push(r.url());
    });
    await page.goto('/');
    await expect(
      page.getByText('הגרלה 2181 · 406 דירות · 15 בניינים · 325 במחיר מטרה'),
    ).toBeVisible();
    await firstCardLink(page).click();
    await page.getByRole('tab', { name: 'הדמיה תלת־ממדית' }).click();
    await expect(page.locator('canvas')).toBeVisible();
    expect(external).toEqual([]);
  });

  test('switches views through the header and deep links work', async ({ page }) => {
    await page.goto('/data');
    await expect(page.getByRole('heading', { name: 'נתוני הפרויקט' })).toBeVisible();
    await page.getByRole('link', { name: /הרשימה שלי/ }).click();
    await expect(page).toHaveURL(/\/my-list$/);
    await page.getByRole('link', { name: 'דירות', exact: true }).click();
    await expect(page.getByRole('heading', { name: /^דירות/ })).toContainText('(406)');
  });

  test('filters update the map, the list and the counts', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'בניין B4, 20 דירות תואמות' }).click();
    await expect(page.getByTestId('elevation')).toBeVisible();
    await expect(page.getByRole('heading', { name: /^דירות/ })).toContainText('(20)');
    await page.getByRole('button', { name: '3', exact: true }).click();
    await expect(page.getByText(/מתוך 406 דירות תואמות/)).toContainText('6 מתוך 406');
    await page.getByRole('button', { name: 'ניקוי סינון' }).click();
    await expect(page.getByRole('heading', { name: /^דירות/ })).toContainText('(406)');
  });
});

test.describe('search, multi-level sort and results export', () => {
  const heading = (page: Page) => page.getByRole('heading', { name: /^דירות/ });

  test('searches by apartment type', async ({ page }) => {
    await page.goto('/');
    const search = page.getByRole('combobox', { name: 'חיפוש לפי טיפוס דירה' });
    await search.fill('t6d');
    await expect(heading(page)).toContainText('(31)');
    await search.fill('T6D, P1');
    await expect(heading(page)).toContainText('(46)');
    await page.getByRole('button', { name: 'ניקוי החיפוש' }).click();
    await expect(heading(page)).toContainText('(406)');
  });

  test('sorts by rooms, then floor from high to low', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox', { name: 'שדה מיון 1' }).selectOption('rooms');
    await page.getByRole('button', { name: 'הוספת רמת מיון' }).click();
    await page.getByRole('combobox', { name: 'שדה מיון 2' }).selectOption('floor');
    await page.getByRole('button', { name: /^כיוון מיון 2:/ }).click();
    await expect(page.getByTestId('sort-summary')).toHaveText(
      'מיון: חדרים (מהמעט להרבה), ואז קומה (מהגבוהה לנמוכה)',
    );
    // the first cards are 3-room apartments, floors descending
    const cards = await page.locator('article').evaluateAll((els) =>
      els.slice(0, 6).map((e) => ({
        text: e.textContent,
        link: e.querySelector('a')?.textContent ?? '',
      })),
    );
    for (const c of cards) expect(c.text).toContain('3 חדרים');
    const floors = cards.map((c) => Number(/קומה (-?\d+)$/.exec(c.link.trim())?.[1]));
    expect(floors.every(Number.isFinite)).toBe(true);
    expect(floors).toEqual([...floors].sort((a, b) => b - a));
  });

  test('exports the filtered results as xlsx', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox', { name: 'חיפוש לפי טיפוס דירה' }).fill('T6D');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'ייצוא 31 דירות לאקסל' }).click();
    expect((await download).suggestedFilename()).toMatch(
      /^almogim-apartments-\d{4}-\d{2}-\d{2}\.xlsx$/,
    );
    await expect(page.getByText('הקובץ נשמר: 31 דירות')).toBeVisible();
  });

  test('Escape in the type search keeps the filter, so the export has only the matches', async ({
    page,
  }) => {
    await page.goto('/');
    const search = page.getByRole('combobox', { name: 'חיפוש לפי טיפוס דירה' });
    await search.click();
    await page.keyboard.type('T6D');
    await page.keyboard.press('Escape'); // e.g. to close the suggestion list
    await expect(search).toHaveValue('T6D');
    await expect(heading(page)).toContainText('(31)');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'ייצוא 31 דירות לאקסל' }).click();
    const wb = XLSX.read(readFileSync(await (await download).path()), { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['דירות'] ?? {});
    expect(rows).toHaveLength(31);
    expect(new Set(rows.map((r) => r['תוכנית']))).toEqual(new Set(['T-T6D']));
  });

  test('no serious axe violations with three sort levels', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'הוספת רמת מיון' }).click();
    await page.getByRole('button', { name: 'הוספת רמת מיון' }).click();
    await page.getByRole('combobox', { name: 'חיפוש לפי טיפוס דירה' }).fill('T5');
    const results = await new AxeBuilder({ page })
      .include('details')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(
      results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => v.id),
    ).toEqual([]);
  });
});

test.describe('apartment sheet', () => {
  test('opens from a card; Escape, Back, close button and outside click close it', async ({
    page,
  }) => {
    await page.goto('/');
    await firstCardLink(page).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/apt=/);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await firstCardLink(page).click();
    await page.goBack();
    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(/apt=/);

    await firstCardLink(page).click();
    await page.getByRole('button', { name: 'סגירה' }).click();
    await expect(dialog).toBeHidden();

    await firstCardLink(page).click();
    // Radix arms outside-click detection just after opening; wait until the dialog is settled.
    await expect(page.getByRole('button', { name: 'סגירה' })).toBeFocused();
    await page.mouse.click(5, 5); // overlay corner, outside the panel
    await expect(dialog).toBeHidden();
  });

  test('a shared link opens the apartment on the requested tab', async ({ page }) => {
    await page.goto('/?apt=A1-1&tab=building');
    await expect(page.getByRole('heading', { name: 'בניין A1 · דירה 1 · קומה 1' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'הבניין והקומה' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('no WebGL context leak after opening and closing the 3D view 20 times', async ({ page }) => {
    test.setTimeout(180_000);
    const warnings: string[] = [];
    page.on('console', (m) => {
      if (/WebGL|context/i.test(m.text())) warnings.push(m.text());
    });
    await page.goto('/?apt=A1-1&tab=schematic');
    await expect(page.locator('canvas')).toBeVisible();
    await page.keyboard.press('Escape');
    for (let i = 0; i < 20; i++) {
      await firstCardLink(page).click();
      await expect(page.locator('canvas')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('canvas')).toHaveCount(0);
    }
    expect(
      warnings.filter(
        (w) => /too many|lost/i.test(w) && !/forceContextLoss|CONTEXT_LOST_WEBGL/.test(w),
      ),
    ).toEqual([]);
  });

  test('every plan type gets its plan model, with the sun from the plan’s north', async ({
    page,
  }) => {
    // A1-1 (T-T5A) and a penthouse, both traced from the 1:100 sheets
    for (const apt of ['A1-1', 'D13-18']) {
      await page.goto(`/?apt=${apt}&tab=schematic`);
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText('מבוסס תוכנית')).toBeVisible();
      await expect(dialog.getByText('מסדרון').first()).toBeVisible();
      await expect(page.getByText(/שמש ישירה בסלון/)).toBeVisible();
      await page.getByRole('radio', { name: 'צהריים 12:00' }).click();
      await expect(page.getByText(/השמש בכיוון/)).toBeVisible();
    }
  });
});

test.describe('floor plans', () => {
  test('the plans tab shows the real sheet; hotspots open neighbours', async ({ page }) => {
    await page.goto('/?apt=A1-1&tab=plans');
    const sheet = page.getByRole('img', { name: /בניין A1. הדירה מסומנת: T-T5A/ });
    await expect(sheet).toBeVisible();
    // the image really loaded (pre-rendered WebP from resources/plans_rendered)
    await expect
      .poll(() => sheet.evaluate((i: HTMLImageElement) => i.naturalWidth), { timeout: 15_000 })
      .toBeGreaterThan(1500);
    await page.getByRole('radio', { name: 'הקומה' }).click();
    await page.getByRole('button', { name: /^דירה 3 · T-T6D/ }).click();
    await expect(page.getByRole('heading', { name: 'בניין A1 · דירה 3 · קומה 1' })).toBeVisible();
    await expect(page).toHaveURL(/apt=A1-3.*tab=plans/);
  });

  test('pan and zoom with the wheel and the buttons', async ({ page }) => {
    await page.goto('/?apt=A1-1&tab=plans&pmode=floor');
    const content = page.getByTestId('plan-content');
    await expect(content).toBeVisible();
    const before = await content.getAttribute('style');
    await page.getByRole('button', { name: 'הגדלה' }).click();
    await expect.poll(() => content.getAttribute('style')).not.toBe(before);
    await page.getByRole('button', { name: 'התאמה למסך' }).click();
    await expect.poll(() => content.getAttribute('style')).toBe(before);
  });

  test('building plans page from the elevation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^בניין B4,/ }).click();
    await page.getByTestId('elevation').getByRole('link', { name: 'תוכניות קומה' }).click();
    await expect(page.getByRole('heading', { name: 'תוכניות בניין B4' })).toBeVisible();
    await page
      .getByRole('navigation', { name: 'גיליונות הבניין' })
      .getByRole('button', { name: 'גג' })
      .click();
    await expect(page).toHaveURL(/sheet=B4-p3/);
  });

  test('the 3D tab uses the plan model for T-T5C', async ({ page }) => {
    await page.goto('/?apt=D15-5&tab=schematic');
    await expect(page.getByText('מבוסס תוכנית ✓')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('radio', { name: 'סיור' }).click();
    await page.getByRole('button', { name: 'קדימה' }).click();
    await page.getByRole('radio', { name: 'מבט על' }).click();
    await expect(page.locator('canvas')).toBeVisible();
  });
});

test.describe('my list', () => {
  test('stars, notes and order survive a reload', async ({ page }) => {
    await page.goto('/');
    const stars = page.locator('article').getByRole('button', { name: 'הוספה לרשימה שלי' });
    await stars.nth(0).click();
    await stars.nth(1).click();
    await expect(page.getByTestId('my-list-count')).toHaveText('2');
    await page.getByRole('link', { name: /הרשימה שלי/ }).click();
    await page.getByRole('textbox').first().fill('לבדוק חניה');
    await page.getByRole('button', { name: 'הורדה בעדיפות' }).first().click();
    await page.waitForTimeout(700); // debounced save (500 ms)
    await page.reload();
    await expect(page.getByRole('listitem')).toHaveCount(2);
    await expect(page.getByRole('textbox').nth(1)).toHaveValue('לבדוק חניה');
  });

  test('picks up a list saved by the legacy site', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'almogim2181.v2',
        JSON.stringify({
          prio: [
            { id: 'B4-15', note: 'מהאתר הישן' },
            { id: 'A1-1', note: '' },
          ],
          az: { 'B4-15': 90 },
        }),
      );
    });
    await page.goto('/my-list');
    await expect(page.getByRole('listitem')).toHaveCount(2);
    await expect(page.getByRole('textbox').first()).toHaveValue('מהאתר הישן');
    // the saved orientation is kept (it is used for imported plan types without a plan model)
    const saved = await page.evaluate(() => localStorage.getItem('almogim2181.v2') ?? '');
    expect(JSON.parse(saved)).toMatchObject({ az: { 'B4-15': 90 } });
  });

  test('exports an xlsx file', async ({ page }) => {
    await page.goto('/');
    await page.locator('article').getByRole('button', { name: 'הוספה לרשימה שלי' }).first().click();
    await page.getByRole('link', { name: /הרשימה שלי/ }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'ייצוא לאקסל' }).click();
    expect((await download).suggestedFilename()).toBe('almogim-priorities.xlsx');
    await expect(page.getByText('הקובץ נשמר')).toBeVisible();
  });
});

test.describe('layout and accessibility', () => {
  for (const path of [
    '/',
    '/my-list',
    '/data',
    '/?apt=A1-1&tab=insights',
    '/?apt=A1-1&tab=building',
    '/?apt=A1-1&tab=plans',
    '/?apt=A1-1&tab=plans&pmode=building',
    '/buildings/A1/plans?floor=9',
    '/?apt=D15-5&tab=schematic',
  ]) {
    test(`no serious axe violations on ${path}`, async ({ page }) => {
      test.setTimeout(60_000); // WebGL pages render slowly on software GL in CI
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const serious = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(
        serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
      ).toEqual([]);
    });
  }

  test('no horizontal page overflow at 360 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
