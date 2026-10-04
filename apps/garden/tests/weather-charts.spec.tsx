import type {
    WeatherForecastDay,
    WeatherHistoryPoint,
} from '@gredice/js/weather';
import { WeatherCharts } from '@gredice/ui/WeatherCharts';
import { expect, test } from '@playwright/experimental-ct-react';

for (const width of [390, 1280]) {
    test(`calm and light wind keep the full category scale at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 800 });
        const to = new Date();
        const from = new Date(to.getTime() - 3_600_000);
        await mount(
            <WeatherCharts
                history={[
                    { recordedAt: from, windSpeed: 0 },
                    { recordedAt: to, windSpeed: 1, windDirection: 'N' },
                ]}
                range={{ from, to }}
                bounds={{ min: from, max: to }}
                onRangeChange={() => undefined}
                metric="wind"
                compact
            />,
        );

        const chart = page.getByRole('application');
        for (const label of ['Tišina', 'Slab', 'Umjeren', 'Jak', 'Olujan']) {
            await expect(chart.getByText(label, { exact: true })).toBeVisible();
        }
        await chart.focus();
        const tooltip = page.locator('.recharts-tooltip-wrapper');
        await expect(
            tooltip.getByText('Tišina', { exact: true }),
        ).toBeVisible();
        await page.keyboard.press('ArrowRight');
        await expect(tooltip.getByText('Slab', { exact: true })).toBeVisible();
        await expect(tooltip).not.toContainText('m/s');
    });

    test(`wind retains named categories and brief changes at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 800 });
        const now = new Date();
        const hourMs = 3_600_000;
        // All three history points share an 8-hour bucket. Averaging would
        // erase the brief strong wind and invent a fractional category.
        const bucketStart =
            Math.floor((now.getTime() - 24 * hourMs) / (8 * hourMs)) *
            8 *
            hourMs;
        const history: WeatherHistoryPoint[] = [0, 3, 1].map(
            (windSpeed, index) => ({
                recordedAt: new Date(
                    bucketStart + index * hourMs,
                ).toISOString(),
                windSpeed,
                windDirection: windSpeed === 0 ? null : 'NW',
            }),
        );
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const forecast: WeatherForecastDay[] = [
            {
                date: `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`,
                entries: [2, 4].map((windStrength, time) => ({
                    time,
                    windStrength,
                    windDirection: 'NE',
                })),
            },
        ];
        const range = {
            from: new Date(bucketStart),
            to: new Date(tomorrow.getTime() + 2 * hourMs),
        };

        await mount(
            <WeatherCharts
                history={history}
                forecast={forecast}
                range={range}
                bounds={{ min: range.from, max: range.to }}
                onRangeChange={() => undefined}
                metric="wind"
                compact
            />,
        );

        const chart = page.getByRole('application');
        for (const label of ['Tišina', 'Slab', 'Umjeren', 'Jak', 'Olujan']) {
            await expect(chart.getByText(label, { exact: true })).toBeVisible();
        }
        await chart.focus();
        const tooltip = page.locator('.recharts-tooltip-wrapper');
        // The bridge at "now" must hold the last historical category (Slab),
        // rather than interpolate a speed between history and forecast.
        for (const [index, label] of [
            'Tišina',
            'Jak',
            'Slab',
            'Slab',
            'Umjeren',
            'Olujan',
        ].entries()) {
            if (index > 0) await page.keyboard.press('ArrowRight');
            await expect(
                tooltip.getByText(label, { exact: true }),
            ).toBeVisible();
            await expect(tooltip).not.toContainText('m/s');
            if (label === 'Jak' || label === 'Slab') {
                await expect(
                    tooltip.getByText('NW', { exact: true }),
                ).toBeVisible();
            }
        }
    });
}
