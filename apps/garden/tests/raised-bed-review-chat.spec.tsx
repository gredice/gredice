import path from 'node:path';
import { expect, test } from '@playwright/experimental-ct-react';
import type { seedMessages } from '../../../packages/game/src/hud/suncokretChatUtils';
import { SuncokretChatHudStory } from './SuncokretChatHudStory';

test.use({ timezoneId: 'Europe/Zagreb' });

test.beforeEach(async ({ page }) => {
    await page.route('**/_next/image?*', (route) =>
        route.fulfill({
            path: path.resolve('public/web-app-manifest-192x192.png'),
            contentType: 'image/png',
        }),
    );
});

const conversationId = 'analysis-501-review-user';
const status = {
    enabled: true,
    model: null,
    limit: {
        retryAt: '2026-09-24T00:00:00Z',
        blockedReason: null,
        trialChatDaysUsed: 1,
        trialChatDaysLimit: 3,
    },
};

for (const viewport of [
    { width: 1280, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
]) {
    test(`review chat stays inline and restores saved follow-ups at ${viewport.width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize(viewport);
        const saved = new Map<string, ReturnType<typeof seedMessages>>();
        let sent: Record<string, unknown> | undefined;
        await page.route('**/api/ai/suncokret/status?*', (route) =>
            route.fulfill({ json: status }),
        );
        await page.route('**/api/ai/suncokret/conversations/*', (route) => {
            const id = decodeURIComponent(
                new URL(route.request().url()).pathname.split('/').at(-1) ?? '',
            );
            const messages = saved.get(id);
            return route.fulfill(
                messages
                    ? {
                          json: {
                              conversation: {
                                  id,
                                  title: 'Savjeti za grah',
                                  model: null,
                                  gardenId: 1,
                                  raisedBedId: 11,
                                  createdAt: '2026-09-22T12:00:00Z',
                                  lastMessageAt: null,
                                  messages,
                              },
                          },
                      }
                    : { status: 404, json: {} },
            );
        });
        await page.route('**/api/ai/suncokret/chat', async (route) => {
            const body = route.request().postDataJSON();
            sent = body;
            saved.set(body.conversationId, [
                ...body.messages,
                {
                    id: 'reply-1',
                    role: 'assistant',
                    parts: [{ type: 'text', text: 'Uberi samo zrele mahune.' }],
                },
            ]);
            const chunks = [
                { type: 'start', messageId: 'reply-1' },
                { type: 'text-start', id: 'answer' },
                {
                    type: 'text-delta',
                    id: 'answer',
                    delta: 'Uberi samo zrele mahune.',
                },
                { type: 'text-end', id: 'answer' },
                { type: 'finish', finishReason: 'stop' },
            ];
            await route.fulfill({
                contentType: 'text/event-stream',
                headers: { 'x-vercel-ai-ui-message-stream': 'v1' },
                body: `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('')}data: [DONE]\n\n`,
            });
        });
        const component = await mount(<SuncokretChatHudStory review />);
        const openReview = () =>
            page
                .getByRole('button', { name: 'Pregledaj savjete suncokreta' })
                .click();
        await openReview();
        const modal = page.getByRole('dialog', {
            name: 'Razgovor sa Suncokretom',
            exact: true,
        });
        const chat = modal;
        await expect(chat.getByRole('textbox')).toBeEnabled();
        await expect(
            modal.getByAltText('Fotografija unosa Fotografiranje gredice - 1'),
        ).toBeVisible();
        await expect(
            page.getByRole('dialog', { name: 'AI analiza fotografije' }),
        ).toHaveCount(0);
        await expect(page.locator('[data-suncokret-placement]')).toHaveCount(1);
        expect((await chat.boundingBox())?.width).toBeLessThanOrEqual(440);
        await expect(
            chat.locator('[data-chat-message-scroller] img').first(),
        ).toBeVisible();
        await expect(chat).toContainText('Grah ima zrele mahune.');
        await expect(modal.getByText(/Fotografija \d+ od \d+/)).toHaveCount(0);
        await expect(
            modal.getByText(/Prikazujem spremljene savjete/),
        ).toHaveCount(0);
        await expect(modal.getByText(/^Analizirano /)).toHaveCount(0);
        await expect(chat.locator('time').first()).toHaveAttribute(
            'datetime',
            '2026-09-22T12:00:00.000Z',
        );
        await expect(chat.locator('time').first()).toBeInViewport();
        await expect(
            chat.getByAltText('Fotografija unosa Fotografiranje gredice - 1'),
        ).toBeInViewport({ ratio: 1 });
        await expect(
            chat
                .getByText('Suncokret', { exact: true })
                .first()
                .locator('span.bg-emerald-500'),
        ).toHaveCount(1);

        await expect(
            chat.getByRole('button', { name: 'Novi razgovor' }),
        ).toBeVisible();
        await page.screenshot({
            path: `/tmp/photo-analysis-conversation-${viewport.width}.png`,
        });
        await chat.getByRole('textbox').fill('Kada da uberem grah?');
        await chat.getByRole('button', { name: 'Pošalji' }).click();
        await expect(chat).toContainText('Uberi samo zrele mahune.');
        expect(sent).toMatchObject({
            conversationId,
            gardenId: 1,
            raisedBedId: 11,
            positionIndex: 1,
            uiContext: { surface: 'plant-details', tab: 'diary' },
        });
        expect(saved.get(conversationId)?.[0]?.metadata).toMatchObject({
            createdAt: '2026-09-22T12:00:00.000Z',
            photoAnalysis: {
                gardenId: 1,
                entryName: 'Fotografiranje gredice',
                imageUrls: ['/web-app-manifest-192x192.png'],
            },
        });
        expect(saved.get(conversationId)?.[1]?.metadata).toMatchObject({
            createdAt: expect.any(String),
        });
        expect(saved.get(conversationId)?.[0]?.parts).toEqual([
            expect.objectContaining({
                text: expect.stringContaining('Grah ima zrele mahune.'),
            }),
        ]);
        await chat
            .getByRole('button', { name: 'Zatvori', exact: true })
            .click();
        await expect(modal).not.toBeVisible();
        await openReview();
        await expect(chat).toContainText('Kada da uberem grah?');
        await expect(chat).toContainText('Uberi samo zrele mahune.');
        await chat
            .getByRole('combobox', { name: 'Odaberi analizu' })
            .selectOption('500');
        await expect(chat.getByRole('textbox')).toBeEnabled();
        await expect(chat).toContainText('Grah raste.');
        await expect(chat).not.toContainText('Kada da uberem grah?');
        await chat
            .getByRole('combobox', { name: 'Odaberi analizu' })
            .selectOption('501');
        await expect(chat).toContainText('Kada da uberem grah?');
        expect(
            await chat.evaluate(
                (element) => element.scrollWidth <= element.clientWidth + 1,
            ),
        ).toBe(true);
        expect(
            await modal.evaluate(
                (element) => element.scrollWidth <= element.clientWidth + 1,
            ),
        ).toBe(true);
        await page.screenshot({
            path: `/tmp/raised-bed-review-chat-${viewport.width}.png`,
        });
        // Remount the entire tree: restoration must come from the server, not component state.
        await component.update(<SuncokretChatHudStory key="reloaded" review />);
        await openReview();
        await expect(chat).toContainText('Uberi samo zrele mahune.');
    });
}

test('failed history reads block writes and can be retried without losing the analysis', async ({
    mount,
    page,
}) => {
    let fail = true;
    let writes = 0;
    await page.route('**/api/ai/suncokret/status?*', (route) =>
        route.fulfill({ json: status }),
    );
    await page.route('**/api/ai/suncokret/conversations/*', (route) =>
        route.fulfill({ status: fail ? 503 : 404, json: {} }),
    );
    await page.route('**/api/ai/suncokret/chat', (route) => {
        writes++;
        return route.abort();
    });
    await mount(<SuncokretChatHudStory review />);
    await page
        .getByRole('button', { name: 'Pregledaj savjete suncokreta' })
        .click();
    const chat = page.getByRole('dialog', { name: 'Razgovor sa Suncokretom' });
    await expect(chat.getByRole('alert')).toContainText(
        'Razgovor se trenutno ne može učitati.',
    );
    await expect(chat.getByRole('textbox')).toBeDisabled();
    await expect(
        chat.getByRole('button', { name: 'Novi razgovor' }),
    ).toBeDisabled();
    await expect(
        chat.getByRole('button', { name: 'Prijašnji razgovori' }),
    ).toBeDisabled();
    await expect(chat).toContainText('Grah ima zrele mahune.');
    expect(writes).toBe(0);
    fail = false;
    await chat.getByRole('button', { name: 'Pokušaj ponovno' }).click();
    await expect(chat.getByRole('textbox')).toBeEnabled();
    await expect(
        chat.getByRole('button', { name: 'Objasni najvažniju preporuku' }),
    ).toBeEnabled();
});

test('a freshly completed analysis uses its saved review identity', async ({
    mount,
    page,
}) => {
    await page.route('**/api/ai/suncokret/status?*', (route) =>
        route.fulfill({ json: status }),
    );
    await page.route('**/api/ai/suncokret/conversations/*', (route) =>
        route.fulfill({ status: 404, json: {} }),
    );
    await page.route('**/analyze-image', (route) =>
        route.fulfill({
            body: '## Sažetak stanja\nGrah ima zrele mahune.',
            contentType: 'text/plain',
        }),
    );
    await page.route('**/ai-history', (route) =>
        route.fulfill({
            json: [
                {
                    id: 501,
                    description: '## Sažetak stanja\nGrah ima zrele mahune.',
                    timestamp: '2026-09-22T12:00:00Z',
                    imageUrls: ['/web-app-manifest-192x192.png'],
                },
            ],
        }),
    );
    await mount(<SuncokretChatHudStory review freshReview />);
    const restore = page.waitForRequest(`**/conversations/${conversationId}?*`);
    await page
        .getByRole('button', { name: 'Pitaj suncokret za savjete' })
        .click();
    await restore;
    await expect(
        page
            .getByRole('dialog', { name: 'Razgovor sa Suncokretom' })
            .getByRole('textbox'),
    ).toBeEnabled();
});

test('new analysis survives closing its source diary and finishes inside the regular chat', async ({
    mount,
    page,
}) => {
    let finishAnalysis: (() => void) | undefined;
    await page.route('**/api/ai/suncokret/status?*', (route) =>
        route.fulfill({ json: status }),
    );
    await page.route('**/api/ai/suncokret/conversations/*', (route) =>
        route.fulfill({ status: 404, json: {} }),
    );
    await page.route('**/analyze-image', async (route) => {
        await new Promise<void>((resolve) => {
            finishAnalysis = resolve;
        });
        await route.fulfill({
            body: '## Sažetak stanja\nGrah ima zrele mahune.',
            contentType: 'text/plain',
        });
    });
    await page.route('**/ai-history', (route) =>
        route.fulfill({
            json: [
                {
                    id: 501,
                    description: '## Sažetak stanja\nGrah ima zrele mahune.',
                    timestamp: '2026-09-22T12:00:00Z',
                    imageUrls: ['/web-app-manifest-192x192.png'],
                },
            ],
        }),
    );
    const component = await mount(
        <SuncokretChatHudStory review freshReview reviewInModal />,
    );
    await page
        .getByRole('button', { name: 'Pitaj suncokret za savjete' })
        .click();
    const chat = page.getByRole('dialog', { name: 'Razgovor sa Suncokretom' });
    await expect(chat.getByRole('textbox')).toBeDisabled();
    await expect(chat).toContainText('Suncokret pregledava fotografije');
    await expect(
        chat.getByAltText('Fotografija unosa Fotografiranje gredice - 1'),
    ).toBeVisible();
    await expect(
        page.getByRole('dialog', { name: 'AI analiza fotografije' }),
    ).toHaveCount(0);
    await expect.poll(() => Boolean(finishAnalysis)).toBe(true);
    await component.update(<SuncokretChatHudStory />);
    await expect(
        page.getByRole('dialog', { name: 'Dnevnik gredice' }),
    ).toHaveCount(0);
    await expect(chat).toBeVisible();
    finishAnalysis?.();
    await expect(chat.getByRole('textbox')).toBeEnabled();
    await expect(chat).toContainText('Grah ima zrele mahune.');
    await expect(page.locator('[data-suncokret-chat]')).toHaveCount(1);
    await chat.getByRole('textbox').fill('Nastavit ću poslije.');
    await chat.getByRole('button', { name: 'Zatvori', exact: true }).click();
    await page.getByRole('button', { name: 'Suncokret AI' }).click();
    await expect(chat.getByRole('textbox')).toHaveValue('Nastavit ću poslije.');
    await chat.getByRole('button', { name: 'Zatvori', exact: true }).click();
    await component.update(<SuncokretChatHudStory review />);
    await page
        .getByRole('button', { name: 'Pregledaj savjete suncokreta' })
        .click();
    await expect(chat.getByRole('textbox')).toHaveValue('Nastavit ću poslije.');
});

test('a failed scan retries in the same chat without losing the photos', async ({
    mount,
    page,
}) => {
    let attempts = 0;
    await page.route('**/api/ai/suncokret/status?*', (route) =>
        route.fulfill({ json: status }),
    );
    await page.route('**/api/ai/suncokret/conversations/*', (route) =>
        route.fulfill({ status: 404, json: {} }),
    );
    await page.route('**/analyze-image', (route) => {
        attempts += 1;
        return route.fulfill(
            attempts === 1
                ? { status: 503, json: { error: 'Analiza nije dostupna.' } }
                : { body: 'Grah raste.', contentType: 'text/plain' },
        );
    });
    await page.route('**/ai-history', (route) =>
        route.fulfill({
            json: [
                {
                    id: 501,
                    description: 'Grah raste.',
                    timestamp: '2026-09-22T12:00:00Z',
                    imageUrls: ['/web-app-manifest-192x192.png'],
                },
            ],
        }),
    );
    await mount(<SuncokretChatHudStory review freshReview />);
    await page
        .getByRole('button', { name: 'Pitaj suncokret za savjete' })
        .click();
    const chat = page.getByRole('dialog', { name: 'Razgovor sa Suncokretom' });
    await expect(chat.getByRole('alert')).toBeVisible();
    await expect(chat.getByRole('textbox')).toBeDisabled();
    await expect(
        chat.getByAltText('Fotografija unosa Fotografiranje gredice - 1'),
    ).toBeVisible();
    await chat.getByRole('button', { name: 'Pokušaj ponovno' }).click();
    await expect(chat.getByRole('textbox')).toBeEnabled();
    await expect(chat).toContainText('Grah raste.');
    expect(attempts).toBe(2);
});

test('ordinary chat history restores review photos and can start a fresh conversation', async ({
    mount,
    page,
}) => {
    const conversation = {
        id: conversationId,
        title: 'Savjeti za grah',
        model: null,
        gardenId: 1,
        raisedBedId: 11,
        createdAt: '2026-09-22T12:00:00Z',
        lastMessageAt: null,
        messages: [
            {
                id: `${conversationId}-0`,
                role: 'assistant',
                metadata: {
                    createdAt: '2026-09-22T12:00:00Z',
                    photoAnalysis: {
                        gardenId: 1,
                        entryName: 'Fotografiranje gredice',
                        imageUrls: ['/web-app-manifest-192x192.png'],
                    },
                },
                parts: [{ type: 'text', text: 'Grah raste.' }],
            },
        ],
    };
    await page.route('**/api/ai/suncokret/status?*', (route) =>
        route.fulfill({ json: status }),
    );
    await page.route('**/api/ai/suncokret/conversations?*', (route) =>
        route.fulfill({ json: { conversations: [conversation] } }),
    );
    await page.route('**/api/ai/suncokret/conversations/*', (route) =>
        route.fulfill({ json: { conversation } }),
    );
    await mount(<SuncokretChatHudStory />);
    await page.getByRole('button', { name: 'Suncokret AI' }).click();
    const chat = page.getByRole('dialog', { name: 'Razgovor sa Suncokretom' });
    await chat.getByRole('button', { name: 'Prijašnji razgovori' }).click();
    await chat.getByRole('button', { name: /Savjeti za grah/ }).click();
    await expect(
        chat.getByAltText('Fotografija unosa Fotografiranje gredice - 1'),
    ).toBeVisible();
    await expect(chat).toContainText('Grah raste.');
    await chat.getByRole('button', { name: 'Novi razgovor' }).click();
    await expect(
        chat.getByAltText('Fotografija unosa Fotografiranje gredice - 1'),
    ).toHaveCount(0);
    await expect(chat.getByRole('textbox')).toBeEnabled();
});

test('photos inside the conversation open in the full-size gallery without losing the draft', async ({
    mount,
    page,
}) => {
    await page.route('**/api/ai/suncokret/status?*', (route) =>
        route.fulfill({ json: status }),
    );
    await page.route('**/api/ai/suncokret/conversations/*', (route) =>
        route.fulfill({ status: 404, json: {} }),
    );
    await mount(
        <SuncokretChatHudStory
            review
            reviewImageUrls={[
                '/web-app-manifest-192x192.png',
                '/web-app-manifest-512x512.png',
            ]}
        />,
    );
    await page
        .getByRole('button', { name: 'Pregledaj savjete suncokreta' })
        .click();
    const modal = page.getByRole('dialog', {
        name: 'Razgovor sa Suncokretom',
        exact: true,
    });
    const composer = modal.getByRole('textbox', { name: 'Pitaj Suncokret' });
    await expect(composer).toBeEnabled();
    await composer.fill('Što vidiš na drugoj fotografiji?');
    await expect(
        modal.getByAltText('Fotografija unosa Fotografiranje gredice - 2'),
    ).toBeVisible();
    await modal
        .getByRole('button', { name: /Otvori sliku 2 u punoj veličini/ })
        .click();
    const gallery = page.getByRole('dialog', { name: 'Pregled galerije' });
    await expect(gallery).toBeVisible();
    await gallery
        .getByRole('button', { name: 'Zatvori pregled galerije', exact: true })
        .click();
    await expect(gallery).not.toBeVisible();
    await expect(modal).toBeVisible();
    await expect(composer).toHaveValue('Što vidiš na drugoj fotografiji?');
});

for (const review of [true, false]) {
    test(`history selection retargets requests from ${review ? 'photo' : 'ordinary'} chat`, async ({
        mount,
        page,
    }) => {
        const other = {
            id: 'other-garden-conversation',
            title: 'Savjeti za drugi vrt',
            model: null,
            gardenId: 2,
            raisedBedId: 22,
            createdAt: '2026-09-22T12:00:00Z',
            lastMessageAt: null,
            messages: [
                {
                    id: 'other-message',
                    role: 'assistant',
                    parts: [{ type: 'text', text: 'Savjeti za drugi vrt.' }],
                },
            ],
        };
        let sent: Record<string, unknown> | undefined;
        await page.route('**/api/ai/suncokret/status?*', (route) =>
            route.fulfill({ json: status }),
        );
        await page.route('**/api/ai/suncokret/conversations?*', (route) =>
            route.fulfill({ json: { conversations: [other] } }),
        );
        await page.route('**/api/ai/suncokret/conversations/*', (route) =>
            route.fulfill(
                route.request().url().includes(other.id)
                    ? { json: { conversation: other } }
                    : { status: 404, json: {} },
            ),
        );
        await page.route('**/api/ai/suncokret/chat', (route) => {
            sent = route.request().postDataJSON();
            return route.fulfill({
                status: 500,
                json: { error: 'Request captured' },
            });
        });
        await mount(<SuncokretChatHudStory review={review} />);
        await page
            .getByRole('button', {
                name: review ? 'Pregledaj savjete suncokreta' : 'Suncokret AI',
            })
            .click();
        const chat = page.getByRole('dialog', {
            name: 'Razgovor sa Suncokretom',
        });
        await chat.getByRole('button', { name: 'Prijašnji razgovori' }).click();
        await chat
            .getByRole('button', { name: /Savjeti za drugi vrt/ })
            .click();
        await chat.getByRole('textbox').fill('Što učiniti ovdje?');
        await chat.getByRole('button', { name: 'Pošalji' }).click();
        await expect
            .poll(() => sent)
            .toMatchObject({
                conversationId: other.id,
                gardenId: 2,
                raisedBedId: 22,
                positionIndex: null,
                uiContext: { surface: 'raised-bed' },
            });
    });
}

test('switching gardens clears a retained photo conversation before the global trigger reopens', async ({
    mount,
    page,
}) => {
    let sent: Record<string, unknown> | undefined;
    await page.route('**/api/ai/suncokret/status?*', (route) =>
        route.fulfill({ json: status }),
    );
    await page.route('**/api/ai/suncokret/conversations/*', (route) =>
        route.fulfill({ status: 404, json: {} }),
    );
    await page.route('**/api/ai/suncokret/chat', (route) => {
        sent = route.request().postDataJSON();
        return route.fulfill({
            status: 500,
            json: { error: 'Request captured' },
        });
    });
    await mount(<SuncokretChatHudStory review switchGarden />);
    await page
        .getByRole('button', { name: 'Pregledaj savjete suncokreta' })
        .click();
    const chat = page.getByRole('dialog', { name: 'Razgovor sa Suncokretom' });
    await chat.getByRole('textbox').fill('Pitanje za prvi vrt');
    await chat.getByRole('button', { name: 'Zatvori', exact: true }).click();
    await page.getByRole('button', { name: 'Otvori drugi vrt' }).click();
    await page.getByRole('button', { name: 'Suncokret AI' }).click();
    await expect(chat).toContainText('Razgovor za Drugi vrt');
    await expect(chat.getByRole('textbox')).toHaveValue('');
    await expect(chat.getByText('Grah ima zrele mahune.')).toHaveCount(0);
    await chat.getByRole('textbox').fill('Pitanje za drugi vrt');
    await chat.getByRole('button', { name: 'Pošalji' }).click();
    await expect
        .poll(() => sent)
        .toMatchObject({
            gardenId: 2,
            raisedBedId: null,
            positionIndex: null,
            uiContext: { surface: 'garden' },
        });
    expect(sent?.conversationId).not.toBe(conversationId);
});

for (const review of [true, false]) {
    test(`message dates group restored ${review ? 'review' : 'HUD'} conversations and streamed replies`, async ({
        mount,
        page,
    }) => {
        await page.clock.setFixedTime(new Date('2026-09-23T12:00:00Z'));
        const id = review ? conversationId : 'dated-chat';
        const times = [
            '2026-09-22T12:00:00.000Z',
            '2026-09-22T12:59:00.000Z',
            '2026-09-22T13:59:00.000Z',
            '2026-09-22T21:50:00.000Z',
            '2026-09-22T22:05:00.000Z',
        ];
        const conversation = {
            id,
            title: 'Razgovor s datumima',
            model: null,
            gardenId: 1,
            raisedBedId: 11,
            createdAt: times[0],
            lastMessageAt: times.at(-1),
            messages: times.map((createdAt, index) => ({
                id: index === 0 && review ? `${id}-0` : `dated-${index}`,
                role: index === 0 ? 'assistant' : 'user',
                metadata: { createdAt },
                parts: [{ type: 'text', text: `Poruka ${index + 1}` }],
            })),
        };
        await page.route('**/api/ai/suncokret/status?*', (route) =>
            route.fulfill({ json: status }),
        );
        await page.route('**/api/ai/suncokret/conversations?*', (route) =>
            route.fulfill({ json: { conversations: [conversation] } }),
        );
        await page.route('**/api/ai/suncokret/conversations/*', (route) =>
            route.fulfill({ json: { conversation } }),
        );
        await page.route('**/api/ai/suncokret/chat', (route) => {
            const chunks = [
                {
                    type: 'start',
                    messageId: 'dated-reply',
                    messageMetadata: { createdAt: '2026-09-23T13:00:00.000Z' },
                },
                { type: 'text-start', id: 'text' },
                { type: 'text-delta', id: 'text', delta: 'Odgovor s datumom' },
                { type: 'text-end', id: 'text' },
                {
                    type: 'finish',
                    finishReason: 'stop',
                    messageMetadata: {
                        createdAt: '2026-09-23T13:00:00.000Z',
                        suncokret: { usage: {} },
                    },
                },
            ];
            return route.fulfill({
                contentType: 'text/event-stream',
                headers: { 'x-vercel-ai-ui-message-stream': 'v1' },
                body: `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('')}data: [DONE]\n\n`,
            });
        });
        await mount(<SuncokretChatHudStory review={review} />);
        if (review) {
            await page
                .getByRole('button', { name: 'Pregledaj savjete suncokreta' })
                .click();
        } else {
            await page.getByRole('button', { name: 'Suncokret AI' }).click();
            await page
                .getByRole('button', { name: 'Prijašnji razgovori' })
                .click();
            await page
                .getByRole('button', { name: /Razgovor s datumima/ })
                .click();
        }
        const chat = page.locator('[data-suncokret-chat]');
        const timestamps = () =>
            chat
                .locator('time')
                .evaluateAll((elements) =>
                    elements.map((element) => element.getAttribute('datetime')),
                );
        await expect
            .poll(timestamps)
            .toEqual([times[0], times[2], times[3], times[4]]);
        await expect(chat.locator('time').first()).toHaveText(
            '22. ruj 2026. 14:00',
        );
        // Date and message belong to the same scroll item, with the date first.
        expect(
            await chat
                .locator('time')
                .first()
                .evaluate(
                    (element) =>
                        element.parentElement?.previousElementSibling === null,
                ),
        ).toBe(true);
        await chat.getByRole('textbox').fill('Nastavimo danas');
        await chat.getByRole('button', { name: 'Pošalji' }).click();
        await expect(chat).toContainText('Odgovor s datumom');
        await expect
            .poll(timestamps)
            .toEqual([
                ...[times[0], times[2], times[3], times[4]],
                '2026-09-23T12:00:00.000Z',
                '2026-09-23T13:00:00.000Z',
            ]);
    });
}
