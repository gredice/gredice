import path from 'node:path';
import { expect, test } from '@playwright/experimental-ct-react';
import type { seedMessages } from '../../../packages/game/src/hud/suncokretChatUtils';
import { SuncokretChatHudStory } from './SuncokretChatHudStory';

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
            name: 'AI analiza fotografije',
            exact: true,
        });
        const chat = modal.getByRole('region', {
            name: 'Razgovor sa Suncokretom',
        });
        await expect(chat.getByRole('textbox')).toBeEnabled();
        await expect(
            modal.getByAltText('Fotografija unosa Fotografiranje gredice'),
        ).toBeVisible();
        await expect(chat).toContainText('Grah ima zrele mahune.');
        await expect(page.locator('[data-suncokret-placement]')).toHaveCount(0);
        await expect(
            chat.getByRole('button', { name: 'Novi razgovor' }),
        ).toHaveCount(0);
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
        expect(saved.get(conversationId)?.[0]?.parts).toEqual([
            expect.objectContaining({
                text: expect.stringContaining('Grah ima zrele mahune.'),
            }),
        ]);
        await page.keyboard.press('Escape');
        await expect(modal).not.toBeVisible();
        await openReview();
        await expect(chat).toContainText('Kada da uberem grah?');
        await expect(chat).toContainText('Uberi samo zrele mahune.');
        await modal.getByRole('button', { name: '21. 09. 2026.' }).click();
        await expect(chat.getByRole('textbox')).toBeEnabled();
        await expect(chat).toContainText('Grah raste.');
        await expect(chat).not.toContainText('Kada da uberem grah?');
        await modal.getByRole('button', { name: '22. 09. 2026.' }).click();
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
    const chat = page.getByRole('region', { name: 'Razgovor sa Suncokretom' });
    await expect(chat.getByRole('alert')).toContainText(
        'Razgovor se trenutno ne može učitati.',
    );
    await expect(chat.getByRole('textbox')).toBeDisabled();
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
            .getByRole('region', { name: 'Razgovor sa Suncokretom' })
            .getByRole('textbox'),
    ).toBeEnabled();
});
