import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const VIEWPORTS = [
  { width: 360, height: 740, name: '360px-mobile' },
  { width: 390, height: 844, name: '390px-mobile' },
  { width: 768, height: 1024, name: '768px-tablet' },
  { width: 1024, height: 768, name: '1024px-laptop' },
  { width: 1440, height: 900, name: '1440px-desktop' },
  { width: 1920, height: 1080, name: '1920px-widescreen' },
];

test.describe('FloodLens Ghana End-to-End & Multi-Viewport Verification', () => {
  test('renders map, filters events, inspects proximity, toggles layers, and captures screenshots', async ({
    page,
  }) => {
    const screenshotsDir = path.resolve(process.cwd(), 'docs', 'screenshots');
    fs.mkdirSync(screenshotsDir, { recursive: true });

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 1. Verify header, map canvas, and initial 65 flood events
    await expect(
      page.getByRole('heading', { name: 'FloodLens Ghana' })
    ).toBeVisible();
    await expect(page.getByTestId('ghana-map-canvas')).toBeVisible();
    await expect(page.getByText('65 Events Shown')).toBeVisible();
    await expect(page.getByTestId('metric-unmonitored-pct')).toHaveText(
      '73.8%'
    );
    await expect(page.getByTestId('metric-avg-station-km')).toHaveText(
      '67.7 km'
    );
    await expect(page.getByTestId('metric-avg-hospital-km')).toHaveText(
      '11 km'
    );

    // Wait a moment for MapLibre vector tiles to settle before screenshot
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(screenshotsDir, '01-desktop-overview.png'),
    });

    // 2. Test Region & Unmonitored filtering
    const regionSelect = page.getByTestId('filter-region-select');
    await regionSelect.selectOption('Northern');
    await expect(page.getByTestId('metric-unmonitored-pct')).not.toHaveText(
      '0%'
    );

    // Reset filters
    await page.getByTestId('reset-filters-btn').click();
    await expect(page.getByText('65 Events Shown')).toBeVisible();

    // 3. Select an event card to open Inspector tab & verify proximity analysis
    const firstEventCard = page
      .locator('[data-testid^="event-card-"]')
      .first();
    await firstEventCard.click();
    await expect(page.getByTestId('event-inspector-detail')).toBeVisible();

    // Test changing proximity radius to 25 km
    await page.getByTestId('radius-btn-25').click();
    await expect(
      page.getByText(/Facilities & Stations Within 25 km/i)
    ).toBeVisible();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotsDir, '02-event-inspector-proximity.png'),
    });

    // Verify source verification link has valid href
    const sourceLink = page.getByRole('link', {
      name: /Verify Source Catalog/i,
    });
    await expect(sourceLink).toHaveAttribute('href', /^https?:\/\//);

    // 4. Switch to Insights tab & verify UNESCO IoT links and Regional RP100 table
    await page.getByTestId('tab-insights').click();
    await expect(page.getByTestId('insights-tab-content')).toBeVisible();
    await expect(
      page.getByText(/UNESCO \/ GMet LoRaWAN IoT Telemetry Links/i)
    ).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotsDir, '03-insights-telemetry-table.png'),
    });

    // 5. Open Sources & Methodology Modal
    await page.getByRole('button', { name: /Sources & Methodology/i }).click();
    await expect(page.getByTestId('methodology-modal')).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotsDir, '04-methodology-modal.png'),
    });
    await page.getByTestId('close-methodology-modal').click();
    await expect(page.getByTestId('methodology-modal')).toBeHidden();

    // 6. Test switching basemap styles (AWS Dark -> AWS Light)
    await page.getByRole('button', { name: 'AWS Dark' }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'AWS Light' }).click();
    await page.waitForTimeout(800);

    // 7. Verify zero uncaught page errors
    expect(pageErrors).toEqual([]);
  });

  for (const vp of VIEWPORTS) {
    test(`verifies responsive layout and zero horizontal overflow at ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      await expect(
        page.getByRole('heading', { name: 'FloodLens Ghana' })
      ).toBeVisible();
      await expect(page.getByTestId('ghana-map-canvas')).toBeVisible();
      await expect(page.getByText('65 Events Shown')).toBeVisible();

      const overflow = await page.evaluate(() => {
        return (
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
        );
      });
      expect(overflow).toBe(false);

      if (vp.width === 390) {
        const screenshotsDir = path.resolve(
          process.cwd(),
          'docs',
          'screenshots'
        );
        fs.mkdirSync(screenshotsDir, { recursive: true });
        await page.waitForTimeout(1200);
        await page.screenshot({
          path: path.join(screenshotsDir, '05-mobile-390px-map.png'),
        });
      }
    });
  }
});
