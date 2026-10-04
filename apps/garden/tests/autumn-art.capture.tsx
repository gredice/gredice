import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/experimental-ct-react';
import { AutumnArtDirectionFixture } from '../../../packages/game/tests/AutumnArtDirectionFixture';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const output = fileURLToPath(
    new URL('../../../docs/autumn-art-direction-2026', import.meta.url),
);
const generatedOutputPath = 'docs/autumn-art-direction-2026';

function captureSource() {
    const git = (...args: string[]) =>
        execFileSync('git', args, {
            cwd: repositoryRoot,
            encoding: 'utf8',
        }).trim();
    const sourceStatus = git(
        'status',
        '--porcelain',
        '--untracked-files=all',
        '--',
        '.',
        `:(exclude)${generatedOutputPath}`,
    );
    expect(
        sourceStatus,
        'Commit capture inputs before regenerating; only generated outputs may be dirty.',
    ).toBe('');
    return {
        sourceCommit: git('rev-parse', 'HEAD'),
        sourceTree: git('rev-parse', 'HEAD^{tree}'),
        sourceStatus,
        excludedOutputPath: generatedOutputPath,
    };
}
const stages = [
    { name: 'early', month: 9, day: 23 },
    { name: 'mid', month: 10, day: 22 },
    { name: 'late', month: 11, day: 21 },
];
const lights: ('sun' | 'overcast' | 'dusk' | 'night')[] = [
    'sun',
    'overcast',
    'dusk',
    'night',
];

test('capture collection art-direction baseline', async ({
    mount,
    page,
    browser,
}) => {
    const source = captureSource();
    await mkdir(output, { recursive: true });
    const records = [];
    const errors: string[] = [];
    page.on('pageerror', (error) => {
        errors.push(error.message);
    });
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
    });
    page.on('requestfailed', (request) =>
        errors.push(`Failed request: ${request.url()}`),
    );
    // A documentation fixture must neither fetch customer data nor write state.
    await page.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (
            !['localhost', '127.0.0.1'].includes(url.hostname) ||
            !['GET', 'HEAD'].includes(request.method())
        ) {
            errors.push(
                `Blocked ${request.method()} ${url.origin}${url.pathname}`,
            );
            return route.abort();
        }
        return route.continue();
    });
    for (const stage of stages) {
        for (const light of lights) {
            const fixture = await mount(
                <AutumnArtDirectionFixture
                    month={stage.month}
                    day={stage.day}
                    light={light}
                />,
            );
            await expect(fixture).toHaveAttribute('data-ready', /.+/);
            const file = `${stage.name}-${light}.png`;
            // Stable screenshots let lighting/material initialization finish.
            await expect(page.locator('canvas')).toHaveScreenshot(file, {
                animations: 'disabled',
            });
            records.push({
                file,
                light,
                date: await fixture.getAttribute('data-date'),
                autumn: JSON.parse(
                    (await fixture.getAttribute('data-autumn')) ?? '{}',
                ),
            });
            await fixture.unmount();
        }
    }
    const mobile = await mount(
        <AutumnArtDirectionFixture
            month={9}
            day={23}
            light="sun"
            tier="low"
            width={390}
            height={440}
        />,
    );
    await expect(mobile).toHaveAttribute('data-ready', /.+/);
    await expect(page.locator('canvas')).toHaveScreenshot('early-sun-low.png', {
        animations: 'disabled',
    });
    await mobile.unmount();
    expect(errors).toEqual([]);
    expect(
        captureSource(),
        'Capture inputs changed during generation.',
    ).toEqual(source);
    await writeFile(
        path.join(output, 'capture-record.json'),
        `${JSON.stringify(
            {
                capturedAt: new Date().toISOString(),
                ...source,
                browser: browser.version(),
                timezone: 'Europe/Zagreb',
                camera: {
                    position: [-100, 100, -100],
                    target: [-0.5, 0.4, -0.5],
                    zoom: 76,
                },
                viewport: { width: 960, height: 680, dpr: 1 },
                fixedTimeSeconds: 12,
                records,
                lowQuality: {
                    file: 'early-sun-low.png',
                    width: 390,
                    height: 440,
                    zoom: 42,
                },
                errors,
            },
            null,
            2,
        )}\n`,
    );
});
