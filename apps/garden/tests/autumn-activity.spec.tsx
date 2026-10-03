import {
    type AutumnActivityCommand,
    type AutumnActivityResponse,
    readStoredAutumnActivityCommand,
} from '@gredice/client';
import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import {
    autumnActivityAccountA,
    autumnActivityAccountB,
    autumnActivityCompletionId,
    autumnActivityWelcomeId,
    createAutumnActivityFixture,
} from '../../../packages/game/tests/autumnActivityFixture';
import { AutumnActivityStory } from './AutumnActivityStory';

test.beforeEach(async ({ page }) => {
    await page.route('https://example.test/WoodlandAcorns.png', (route) =>
        route.fulfill({
            path: '../www/public/assets/blocks/WoodlandAcorns.webp',
            contentType: 'image/webp',
        }),
    );
    await page.route('https://example.test/AutumnWreathPost.png', (route) =>
        route.fulfill({
            path: '../www/public/assets/blocks/AutumnWreathPost.webp',
            contentType: 'image/webp',
        }),
    );
});

function apply(
    state: ReturnType<typeof createAutumnActivityFixture>,
    command: AutumnActivityCommand,
    replayed = false,
): AutumnActivityResponse {
    const progress = state.progress;
    if (!progress) throw new Error('Missing fixture progress');
    const granted: AutumnActivityResponse['granted'] = [];
    if (command.action.kind === 'claim-welcome') {
        if (!progress.welcomePurchaseId)
            granted.push({
                kind: 'welcome',
                purchaseId: autumnActivityWelcomeId,
            });
        progress.welcomePurchaseId = autumnActivityWelcomeId;
    } else if (!progress.discoveredMotifIds.includes(command.action.motifId)) {
        progress.discoveredMotifIds.push(command.action.motifId);
        if (progress.discoveredMotifIds.length === 6) {
            progress.completed = true;
            progress.completionPurchaseId = autumnActivityCompletionId;
            granted.push({
                kind: 'completion',
                purchaseId: autumnActivityCompletionId,
            });
        }
    }
    return {
        accountId: command.expectedAccountId,
        operationId: command.operationId,
        campaignId: command.campaignId,
        campaignVersionId: command.campaignVersionId,
        progress: structuredClone(progress),
        granted,
        chargedSunflowers: 0,
        replayed,
    };
}
async function open(page: Page) {
    await page
        .getByRole('button', { name: 'Jesenski album', exact: true })
        .click();
    await expect(
        page.getByRole('dialog', { name: 'Jesenski album', exact: true }),
    ).toBeVisible();
}
async function remount(page: Page) {
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Odmontiraj album' }).click();
    await page.getByRole('button', { name: 'Ponovno montiraj album' }).click();
    await open(page);
}

test('mobile keyboard rules and exact gifts precede participation; server progress survives remount and completion', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const state = createAutumnActivityFixture();
    const commands: AutumnActivityCommand[] = [];
    await page.route('**/api/accounts/current/autumn-activity', (route) =>
        route.fulfill({ json: state }),
    );
    await page.route(
        '**/api/accounts/current/autumn-activity/actions',
        (route) => {
            const command = readStoredAutumnActivityCommand(
                route.request().postDataJSON(),
            );
            if (!command) throw new Error('Invalid UI command');
            commands.push(command);
            return route.fulfill({ json: apply(state, command) });
        },
    );
    await mount(<AutumnActivityStory />);
    await page
        .getByRole('button', { name: 'Jesenski album', exact: true })
        .focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Sudjelovanje je dobrovoljno/)).toBeVisible();
    await expect(page.getByText('Šumski žirevi × 1')).toBeVisible();
    await expect(page.getByText('Jesenski vijenac × 1')).toBeVisible();
    expect(commands).toEqual([]);
    for (const image of await page.getByRole('img', { name: /Prikaz:/ }).all())
        await expect
            .poll(() =>
                image.evaluate(
                    (element) =>
                        element instanceof HTMLImageElement &&
                        element.naturalWidth > 0,
                ),
            )
            .toBe(true);
    await page.screenshot({ path: '/tmp/gredice-4996-mobile-rewards.png' });
    await page
        .getByRole('button', {
            name: 'Preuzmi ukras dobrodošlice',
            exact: true,
        })
        .click();
    await expect(
        page.getByRole('button', { name: 'Ukras dobrodošlice preuzet' }),
    ).toBeDisabled();
    const motifs = state.campaign?.motifs ?? [];
    for (const [index, motif] of motifs.entries()) {
        await page
            .getByRole('button', {
                name: new RegExp(`${motif.name}.*Prikupi motiv`),
            })
            .click();
        await expect(
            page.getByText(
                index === 5
                    ? /Svih šest motiva je spremljeno/
                    : `Prikupljeno ${index + 1} od 6 motiva`,
            ),
        ).toBeVisible();
        if (index === 1) {
            await page
                .getByRole('button', { name: /Kapica žira.*Prikupi motiv/ })
                .scrollIntoViewIfNeeded();
            await page.screenshot({
                path: '/tmp/gredice-4996-mobile-album.png',
            });
            await remount(page);
        }
    }
    expect(commands).toHaveLength(7);
    expect(new Set(commands.map((command) => command.operationId)).size).toBe(
        7,
    );
    await expect(
        page.getByRole('button', { name: 'Otvori moje pakete' }),
    ).toBeVisible();
    await remount(page);
    await expect(
        page.getByText(/Svih šest motiva je spremljeno/),
    ).toBeVisible();
    expect(commands).toHaveLength(7);
    const dialog = page.getByRole('dialog');
    expect(
        await dialog.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
        ),
    ).toBe(true);
});

test('lost response and reauthentication survive closing/remount with the same exact command', async ({
    mount,
    page,
}) => {
    const state = createAutumnActivityFixture();
    const commands: AutumnActivityCommand[] = [];
    let saved: AutumnActivityResponse | undefined;
    await page.route('**/api/accounts/current/autumn-activity', (route) =>
        route.fulfill({ json: state }),
    );
    await page.route(
        '**/api/accounts/current/autumn-activity/actions',
        (route) => {
            const command = readStoredAutumnActivityCommand(
                route.request().postDataJSON(),
            );
            if (!command) throw new Error('Invalid UI command');
            commands.push(command);
            if (commands.length === 1) {
                saved = apply(state, command);
                return route.abort('failed');
            }
            if (commands.length === 2)
                return route.fulfill({
                    status: 401,
                    json: { error: 'Ponovno se prijavi.' },
                });
            return route.fulfill({ json: { ...saved, replayed: true } });
        },
    );
    await mount(<AutumnActivityStory />);
    await open(page);
    await page
        .getByRole('button', { name: /Javorov list.*Prikupi motiv/ })
        .click();
    await expect(
        page.getByRole('button', { name: 'Provjeri isti zahtjev' }),
    ).toBeVisible();
    await remount(page);
    await page.getByRole('button', { name: 'Provjeri isti zahtjev' }).click();
    await expect(page.getByText('Ponovno se prijavi.')).toBeVisible();
    await remount(page);
    await page.getByRole('button', { name: 'Provjeri isti zahtjev' }).click();
    await expect(
        page.getByRole('button', { name: 'Provjeri isti zahtjev' }),
    ).toHaveCount(0);
    expect(commands).toHaveLength(3);
    expect(commands[1]).toEqual(commands[0]);
    expect(commands[2]).toEqual(commands[0]);
    await expect(page.getByText('Prikupljeno 1 od 6 motiva')).toBeVisible();
});

test('shared-cookie owner change with unchanged cached account never grants the wrong owner and keeps recovery', async ({
    mount,
    page,
}) => {
    const state = createAutumnActivityFixture();
    const commands: AutumnActivityCommand[] = [];
    let serverOwner = autumnActivityAccountA;
    let saved: AutumnActivityResponse | undefined;
    await page.route('**/api/accounts/current/autumn-activity', (route) =>
        route.fulfill({ json: state }),
    );
    await page.route(
        '**/api/accounts/current/autumn-activity/actions',
        (route) => {
            const command = readStoredAutumnActivityCommand(
                route.request().postDataJSON(),
            );
            if (!command) throw new Error('Invalid UI command');
            commands.push(command);
            if (serverOwner !== command.expectedAccountId)
                return route.fulfill({
                    status: 409,
                    json: {
                        code: 'EXPECTED_ACCOUNT_MISMATCH',
                        error: 'Račun je promijenjen.',
                    },
                });
            if (!saved) {
                saved = apply(state, command);
                return route.abort('failed');
            }
            return route.fulfill({ json: { ...saved, replayed: true } });
        },
    );
    await mount(<AutumnActivityStory />);
    await open(page);
    await page
        .getByRole('button', {
            name: 'Preuzmi ukras dobrodošlice',
            exact: true,
        })
        .click();
    await expect(
        page.getByRole('button', { name: 'Provjeri isti zahtjev' }),
    ).toBeVisible();
    serverOwner = autumnActivityAccountB;
    await page.getByRole('button', { name: 'Provjeri isti zahtjev' }).click();
    await expect(page.getByText('Račun je promijenjen.')).toBeVisible();
    serverOwner = autumnActivityAccountA;
    await remount(page);
    await page.getByRole('button', { name: 'Provjeri isti zahtjev' }).click();
    await expect(
        page.getByRole('button', { name: 'Provjeri isti zahtjev' }),
    ).toHaveCount(0);
    expect(commands).toHaveLength(3);
    expect(
        commands.every(
            (command) => command.expectedAccountId === autumnActivityAccountA,
        ),
    ).toBe(true);
    expect(commands[1]).toEqual(commands[0]);
    expect(commands[2]).toEqual(commands[0]);
});

test('read error is persistent and retryable; account switch hides old progress, expiry keeps the album', async ({
    mount,
    page,
}) => {
    let state = createAutumnActivityFixture();
    let failed = true;
    await page.route('**/api/accounts/current/autumn-activity', (route) =>
        failed
            ? route.fulfill({ status: 503, json: { error: 'Unavailable' } })
            : route.fulfill({ json: state }),
    );
    await mount(<AutumnActivityStory />);
    await open(page);
    await expect(page.getByRole('alert')).toContainText(
        'Jesenski album trenutačno nije moguće učitati.',
    );
    failed = false;
    if (state.progress)
        state.progress.discoveredMotifIds = ['maple-leaf', 'oak-leaf'];
    await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();
    await expect(page.getByText('Prikupljeno 2 od 6 motiva')).toBeVisible();
    state = {
        ...createAutumnActivityFixture(),
        accountId: autumnActivityAccountB,
        eventStatus: 'ended',
        actionAvailable: false,
    };
    await page.evaluate(() =>
        window.dispatchEvent(
            new CustomEvent('test-activity-account', { detail: 'B' }),
        ),
    );
    await expect(page.getByText('Prikupljeno 0 od 6 motiva')).toBeVisible();
    await expect(page.getByText(/Prikupljanje je završilo/)).toBeVisible();
    await expect(
        page.getByRole('button', { name: /Javorov list.*Prikupi motiv/ }),
    ).toBeDisabled();
    await expect(page.getByText('Prikupljeno 2 od 6 motiva')).toHaveCount(0);
});

test('a real second tab invalidates only the matching account progress', async ({
    mount,
    page,
    context,
}) => {
    const state = createAutumnActivityFixture();
    let reads = 0;
    await page.route('**/api/accounts/current/autumn-activity', (route) => {
        reads++;
        return route.fulfill({ json: state });
    });
    await mount(<AutumnActivityStory />);
    await open(page);
    await expect(page.getByText('Prikupljeno 0 od 6 motiva')).toBeVisible();
    const other = await context.newPage();
    await other.goto(page.url());
    if (state.progress) state.progress.discoveredMotifIds = ['acorn'];
    await other.evaluate(
        (account) =>
            localStorage.setItem(
                `gredice:autumn-activity-refresh:v1:${JSON.stringify(['activity-user', account])}`,
                crypto.randomUUID(),
            ),
        autumnActivityAccountA,
    );
    await expect(page.getByText('Prikupljeno 1 od 6 motiva')).toBeVisible();
    expect(reads).toBeGreaterThan(1);
    await other.close();
});

test('uncertain action stays private across selected-account changes and can recover with discovery disabled', async ({
    mount,
    page,
}) => {
    const states = new Map([
        [autumnActivityAccountA, createAutumnActivityFixture()],
        [
            autumnActivityAccountB,
            {
                ...createAutumnActivityFixture(),
                accountId: autumnActivityAccountB,
            },
        ],
    ]);
    const commands: AutumnActivityCommand[] = [];
    let owner = autumnActivityAccountA;
    let saved: AutumnActivityResponse | undefined;
    let disabled = false;
    await page.route('**/api/accounts/current/autumn-activity', (route) =>
        route.fulfill({
            json: disabled
                ? {
                      ...createAutumnActivityFixture(),
                      enabled: false,
                      campaign: null,
                      progress: null,
                      eventStatus: null,
                      actionAvailable: false,
                      readiness: 'disabled',
                  }
                : states.get(owner),
        }),
    );
    await page.route(
        '**/api/accounts/current/autumn-activity/actions',
        (route) => {
            const command = readStoredAutumnActivityCommand(
                route.request().postDataJSON(),
            );
            const state = states.get(owner);
            if (!command || !state) throw new Error('Invalid fixture command');
            commands.push(command);
            if (!saved) {
                saved = apply(state, command);
                return route.abort('failed');
            }
            return route.fulfill({ json: { ...saved, replayed: true } });
        },
    );
    await mount(<AutumnActivityStory />);
    await open(page);
    await page
        .getByRole('button', { name: /Javorov list.*Prikupi motiv/ })
        .click();
    await expect(
        page.getByRole('button', { name: 'Provjeri isti zahtjev' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    owner = autumnActivityAccountB;
    await page.evaluate(() =>
        window.dispatchEvent(
            new CustomEvent('test-activity-account', { detail: 'B' }),
        ),
    );
    await open(page);
    await expect(page.getByText('Prikupljeno 0 od 6 motiva')).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Provjeri isti zahtjev' }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    owner = autumnActivityAccountA;
    disabled = true;
    await page.evaluate(() =>
        window.dispatchEvent(
            new CustomEvent('test-activity-account', { detail: 'A' }),
        ),
    );
    await open(page);
    await expect(
        page.getByRole('button', { name: 'Provjeri isti zahtjev' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Provjeri isti zahtjev' }).click();
    await expect(
        page.getByRole('button', { name: 'Provjeri isti zahtjev' }),
    ).toHaveCount(0);
    expect(commands).toHaveLength(2);
    expect(commands[1]).toEqual(commands[0]);
});

test('disabled rollout, owned inventory, anonymous and sandbox contexts issue no activity reads', async ({
    mount,
    page,
}) => {
    let reads = 0;
    await page.route('**/api/accounts/current/autumn-activity*', (route) => {
        reads++;
        return route.fulfill({ json: createAutumnActivityFixture() });
    });
    for (const props of [
        { rollout: false },
        { packs: false },
        { anonymous: true },
        { sandbox: true },
        { mock: true },
    ]) {
        const component = await mount(<AutumnActivityStory {...props} />);
        await expect(
            page.getByRole('button', { name: 'Jesenski album', exact: true }),
        ).toHaveCount(0);
        await component.unmount();
    }
    expect(reads).toBe(0);
});

test('reconnect refreshes authoritative progress without posting or granting locally', async ({
    mount,
    page,
    context,
}) => {
    const state = createAutumnActivityFixture();
    let writes = 0;
    await page.route('**/api/accounts/current/autumn-activity', (route) =>
        route.fulfill({ json: state }),
    );
    await page.route(
        '**/api/accounts/current/autumn-activity/actions',
        (route) => {
            writes++;
            return route.fulfill({
                status: 500,
                json: { error: 'Unexpected write' },
            });
        },
    );
    await mount(<AutumnActivityStory />);
    await open(page);
    await expect(page.getByText('Prikupljeno 0 od 6 motiva')).toBeVisible();
    await expect(
        page.getByRole('dialog').locator('[aria-busy]'),
    ).toHaveAttribute('aria-busy', 'false');
    await context.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    if (state.progress) state.progress.discoveredMotifIds = ['acorn'];
    await context.setOffline(false);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
    await expect(page.getByText('Prikupljeno 1 od 6 motiva')).toBeVisible();
    expect(writes).toBe(0);
    for (const image of await page.getByRole('img', { name: /Prikaz:/ }).all())
        await expect
            .poll(() =>
                image.evaluate(
                    (element) =>
                        element instanceof HTMLImageElement &&
                        element.naturalWidth > 0,
                ),
            )
            .toBe(true);
    await page.screenshot({ path: '/tmp/gredice-4996-desktop-album.png' });
});

test('reviewed reward preview failure is visible and retry preserves exact configured URL', async ({
    mount,
    page,
}) => {
    const state = createAutumnActivityFixture();
    let failed = true;
    let attempts = 0;
    await page.route('**/api/accounts/current/autumn-activity', (route) =>
        route.fulfill({ json: state }),
    );
    await page.route('https://example.test/WoodlandAcorns.png', (route) => {
        attempts++;
        return failed
            ? route.abort('failed')
            : route.fulfill({
                  path: '../www/public/assets/blocks/WoodlandAcorns.webp',
                  contentType: 'image/webp',
              });
    });
    await mount(<AutumnActivityStory />);
    await open(page);
    await expect(page.getByText('Prikaz ukrasa nije učitan.')).toBeVisible();
    failed = false;
    await page.getByRole('button', { name: 'Ponovno učitaj prikaz' }).click();
    const image = page.getByRole('img', { name: 'Prikaz: Šumski žirevi' });
    await expect
        .poll(() =>
            image.evaluate(
                (element) =>
                    element instanceof HTMLImageElement &&
                    element.naturalWidth > 0,
            ),
        )
        .toBe(true);
    await expect(image).toHaveAttribute(
        'src',
        'https://example.test/WoodlandAcorns.png',
    );
    expect(attempts).toBe(2);
});
