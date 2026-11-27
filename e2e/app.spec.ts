import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

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
    await page.getByRole('tab', { name: 'הדמיה סכמטית' }).click();
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

  test('orientation enables the sun simulation and is remembered', async ({ page }) => {
    await page.goto('/?apt=A1-1&tab=schematic');
    await page.getByRole('combobox').selectOption({ label: 'דרום' });
    await expect(page.getByText(/שמש ישירה בסלון/)).toBeVisible();
    await page.getByRole('radio', { name: 'צהריים 12:00' }).click();
    await expect(page.getByText(/השמש בכיוון/)).toBeVisible();
    await page.reload();
    await expect(page.getByRole('combobox')).toHaveValue('180');
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
    await page.goto('/?apt=B4-15&tab=schematic');
    await expect(page.getByRole('combobox')).toHaveValue('90');
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
  ]) {
    test(`no serious axe violations on ${path}`, async ({ page }) => {
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
