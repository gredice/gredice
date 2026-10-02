import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/experimental-ct-react';
import {
    autumnArrangements,
    getAutumnArrangementItems,
    getAutumnArrangementLayout,
} from '../../../packages/game/src/arrangements/autumnArrangements';
import { getLocalSandboxBlockData } from '../../../packages/game/src/localSandboxBlockData';
import { AutumnArrangementFixture } from '../../../packages/game/tests/AutumnArrangementFixture';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const output = path.join(repositoryRoot, 'docs/autumn-arrangements-2026');
const publicOutput = path.join(
    repositoryRoot,
    'apps/garden/public/assets/arrangements',
);
function captureSource() {
    const git = (...args: string[]) =>
        execFileSync('git', args, {
            cwd: repositoryRoot,
            encoding: 'utf8',
        }).trim();
    const status = git(
        'status',
        '--porcelain',
        '--untracked-files=all',
        '--',
        '.',
        ':(exclude)docs/autumn-arrangements-2026',
        ':(exclude)apps/garden/public/assets/arrangements',
    );
    expect(status, 'Commit capture inputs before generation.').toBe('');
    return {
        commit: git('rev-parse', 'HEAD'),
        tree: git('rev-parse', 'HEAD^{tree}'),
        status,
    };
}
const stages: ('earlyAutumn' | 'midAutumn' | 'lateAutumn')[] = [
    'earlyAutumn',
    'midAutumn',
    'lateAutumn',
];
const lights: ('day' | 'overcast' | 'dusk' | 'night')[] = [
    'day',
    'overcast',
    'dusk',
    'night',
];

for (const arrangement of autumnArrangements) {
    for (const small of [false, true]) {
        test(`${arrangement.id} ${small ? 'mobile-low-static' : 'desktop-high'}`, async ({
            mount,
            page,
            browser,
        }) => {
            const source = captureSource();
            await mkdir(output, { recursive: true });
            await mkdir(publicOutput, { recursive: true });
            const errors: string[] = [];
            const records = [];
            page.on('pageerror', (error) => errors.push(error.message));
            page.on('console', (message) => {
                if (message.type() === 'error') errors.push(message.text());
            });
            page.on('requestfailed', (request) =>
                errors.push(`Failed request: ${request.url()}`),
            );
            await page.emulateMedia({
                reducedMotion: small ? 'reduce' : 'no-preference',
            });
            await page.route('**/*', (route) => {
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
                        <AutumnArrangementFixture
                            arrangementId={arrangement.id}
                            stage={stage}
                            light={light}
                            small={small}
                        />,
                    );
                    await expect(fixture).toHaveAttribute('data-ready', /.+/);
                    const objects: {
                        id: string;
                        entityName: string;
                        role: string;
                        meshes: number;
                        screen: {
                            minX: number;
                            maxX: number;
                            minY: number;
                            maxY: number;
                        };
                    }[] = JSON.parse(
                        (await fixture.getAttribute('data-ready')) ?? '[]',
                    );
                    expect(objects.map((object) => object.id).sort()).toEqual(
                        arrangement.placements
                            .map((placement) => placement.id)
                            .sort(),
                    );
                    for (const object of objects) {
                        expect(object.meshes).toBeGreaterThan(0);
                        expect(
                            object.screen.minX,
                            `${object.id} left`,
                        ).toBeGreaterThanOrEqual(0);
                        expect(
                            object.screen.maxX,
                            `${object.id} right`,
                        ).toBeLessThanOrEqual(small ? 390 : 780);
                        expect(
                            object.screen.minY,
                            `${object.id} top`,
                        ).toBeGreaterThanOrEqual(0);
                        expect(
                            object.screen.maxY,
                            `${object.id} bottom`,
                        ).toBeLessThanOrEqual(small ? 440 : 600);
                        if (object.role === 'included') {
                            expect(
                                object.screen.maxX - object.screen.minX,
                            ).toBeGreaterThan(14);
                            expect(
                                object.screen.maxY - object.screen.minY,
                            ).toBeGreaterThan(10);
                        }
                    }
                    const file = `${arrangement.id}-${stage}-${light}${small ? '-low-static' : ''}.png`;
                    await expect(fixture.locator('canvas')).toHaveScreenshot(
                        file,
                        { animations: 'disabled' },
                    );
                    records.push({
                        file,
                        stage,
                        light,
                        date: await fixture.getAttribute('data-date'),
                        autumn: JSON.parse(
                            (await fixture.getAttribute('data-autumn')) ?? '{}',
                        ),
                        objects,
                    });
                    if (!small && stage === 'earlyAutumn' && light === 'day')
                        await copyFile(
                            path.join(output, file),
                            path.join(publicOutput, `${arrangement.id}.png`),
                        );
                    await fixture.unmount();
                }
            }
            expect(errors).toEqual([]);
            expect(captureSource()).toEqual(source);
            await writeFile(
                path.join(
                    output,
                    `${arrangement.id}${small ? '-low-static' : ''}.json`,
                ),
                `${JSON.stringify(
                    {
                        source,
                        browser: browser.version(),
                        timezone: 'Europe/Zagreb',
                        camera: {
                            position: [-100, 100, -100],
                            target: [-0.5, 0.8, -0.5],
                            zoom: small ? 53 : 92,
                        },
                        viewport: {
                            width: small ? 390 : 780,
                            height: small ? 440 : 600,
                            dpr: 1,
                        },
                        fixedTimeSeconds: 12,
                        reducedMotion: small,
                        quality: small ? 'low' : 'high',
                        included: getAutumnArrangementItems(
                            arrangement,
                            'included',
                        ),
                        scenery: getAutumnArrangementItems(
                            arrangement,
                            'scenery',
                        ),
                        layout: getAutumnArrangementLayout(
                            arrangement,
                            getLocalSandboxBlockData(),
                        ),
                        records,
                        errors,
                    },
                    null,
                    2,
                )}\n`,
            );
        });
    }
}
