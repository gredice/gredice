import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import { SuncokretChatHudStory } from './SuncokretChatHudStory';

const statusResponse = {
    enabled: true,
    debugEnabled: false,
    model: { id: 'openai/gpt-5.5', label: 'GPT-5.5' },
    limit: {
        retryAt: '2026-07-11T00:00:00.000Z',
        blockedReason: null,
        trialChatDaysUsed: 1,
        trialChatDaysLimit: 5,
    },
    usage: {
        day: { usedPercent: 12.5, remainingPercent: 87.5 },
        week: { usedPercent: 4, remainingPercent: 96 },
        liveOutputPercentPerToken: { day: 0.01, week: 0.002 },
    },
};

function uiMessageStream(chunks: Record<string, unknown>[]) {
    return `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('')}data: [DONE]\n\n`;
}

async function mockSuncokretRoutes(page: Page) {
    page.on('pageerror', (error) => console.error(error));
    page.on('console', (message) => {
        if (message.type() === 'error') {
            console.error(message.text());
        }
    });
    await page.route('**/api/ai/suncokret/status**', (route) =>
        route.fulfill({ json: statusResponse }),
    );
    await page.route('**/api/ai/suncokret/models**', (route) =>
        route.fulfill({
            json: {
                models: [
                    { id: 'openai/gpt-5.5', label: 'GPT-5.5' },
                    { id: 'anthropic/claude-4', label: 'Claude 4' },
                ],
            },
        }),
    );
}

test('production chat hides developer controls and shows visual usage', async ({
    mount,
    page,
}) => {
    await mockSuncokretRoutes(page);
    let modelRequests = 0;
    page.on('request', (request) => {
        if (request.url().includes('/api/ai/suncokret/models')) {
            modelRequests += 1;
        }
    });

    await mount(<SuncokretChatHudStory />);
    await page.getByRole('button', { name: 'Suncokret AI' }).click();

    const chat = page.getByRole('dialog', {
        name: 'Razgovor sa Suncokretom',
    });
    await expect(chat).toBeVisible();
    await expect(chat).toContainText('Razgovor za Aleksov vrt');
    await expect(chat).toContainText('Danas');
    await expect(chat).toContainText('Ovaj tjedan');
    await expect(chat).toContainText('12,5% iskorišteno');
    await expect(chat).toContainText('87,5% preostalo');
    await expect(chat).not.toContainText('USD');
    await expect(chat).not.toContainText('token');
    await expect(chat).not.toContainText('AI vrtni pomoćnik');
    await expect(page.getByLabel('AI model')).toHaveCount(0);
    expect(modelRequests).toBe(0);
    await expect(chat).toHaveClass(/border-b-amber-400/);
    await expect(page.locator('[data-suncokret-hud-trigger]')).toHaveClass(
        /border-amber-400/,
    );
    await expect(
        page.locator('[data-suncokret-placement="anchored"]'),
    ).toBeVisible();
});

test('debug chat exposes the model picker', async ({ mount, page }) => {
    await mockSuncokretRoutes(page);
    await mount(<SuncokretChatHudStory debug />);
    await page.getByRole('button', { name: 'Suncokret AI' }).click();

    await expect(page.getByLabel('AI model')).toBeVisible();
    await expect(page.getByLabel('AI model').locator('option')).toHaveCount(2);
});

test('settings context replaces the raised-bed context in the header', async ({
    mount,
    page,
}) => {
    await mockSuncokretRoutes(page);
    await mount(<SuncokretChatHudStory settingsSection="igra" />);
    await page.getByRole('button', { name: 'Suncokret AI' }).click();

    const chat = page.getByRole('dialog', {
        name: 'Razgovor sa Suncokretom',
    });
    await expect(chat).toContainText('Razgovor za postavke igre');
    await expect(chat).toContainText('Pomozi mi s ovom sekcijom');
});

test('context trigger opens weather suggestions anchored to the trigger', async ({
    mount,
    page,
}) => {
    await mockSuncokretRoutes(page);
    await mount(
        <SuncokretChatHudStory
            contextTarget={{
                conversationLabel: 'vremensku prognozu',
                gardenId: 1,
                positionIndex: null,
                raisedBedId: null,
                uiContext: { surface: 'weather', view: 'forecast' },
            }}
        />,
    );
    await page
        .getByRole('button', { name: 'Pitaj Suncokreta u kontekstu' })
        .click();

    const chat = page.getByRole('dialog', {
        name: 'Razgovor sa Suncokretom',
    });
    await expect(chat).toContainText('Razgovor za vremensku prognozu');
    await expect(chat).toContainText('Pripremi vrt za prognozu');
    await expect(chat).toContainText('Odaberi najbolje dane za radove');
    await expect(
        page.locator('[data-suncokret-placement="anchored"]'),
    ).toBeVisible();

    const triggerBox = await page
        .getByRole('button', { name: 'Pitaj Suncokreta u kontekstu' })
        .boundingBox();
    const chatBox = await chat.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(chatBox).not.toBeNull();
    if (triggerBox && chatBox) {
        const horizontalGap = Math.min(
            Math.abs(chatBox.x - (triggerBox.x + triggerBox.width)),
            Math.abs(triggerBox.x - (chatBox.x + chatBox.width)),
        );
        expect(horizontalGap).toBeLessThanOrEqual(16);
    }
});

test('raised-bed closeup uses the contextual trigger and anchored chat', async ({
    mount,
    page,
}) => {
    await mockSuncokretRoutes(page);
    await mount(
        <SuncokretChatHudStory
            focusedRaisedBed
            contextTarget={{
                conversationLabel: 'Sunčano Sunce',
                gardenId: 1,
                positionIndex: null,
                raisedBedId: 11,
                uiContext: { surface: 'raised-bed' },
            }}
        />,
    );

    await expect(page.locator('[data-suncokret-hud-trigger]')).toHaveCount(0);
    await page
        .getByRole('button', { name: 'Pitaj Suncokreta u kontekstu' })
        .click();
    await expect(
        page.locator('[data-suncokret-placement="anchored"]'),
    ).toBeVisible();
});

test('context selected after chat initialization is sent with the request', async ({
    mount,
    page,
}) => {
    await mockSuncokretRoutes(page);
    let requestBody: Record<string, unknown> | null = null;
    await page.route('**/api/ai/suncokret/chat', async (route) => {
        const payload = route.request().postDataJSON() as unknown;
        requestBody =
            payload && typeof payload === 'object' && !Array.isArray(payload)
                ? (payload as Record<string, unknown>)
                : null;
        await route.fulfill({
            status: 500,
            json: { error: 'Test request captured' },
        });
    });

    await mount(
        <SuncokretChatHudStory
            contextTarget={{
                conversationLabel: 'Sunčano Sunce',
                gardenId: 1,
                positionIndex: null,
                raisedBedId: 11,
                uiContext: { surface: 'raised-bed' },
            }}
        />,
    );
    await page
        .getByRole('button', { name: 'Pitaj Suncokreta u kontekstu' })
        .click();
    await page
        .getByRole('textbox', { name: 'Pitaj Suncokret' })
        .fill('Što posaditi ovdje?');
    await page.getByRole('button', { name: 'Pošalji' }).click();

    await expect.poll(() => requestBody).not.toBeNull();
    expect(requestBody).toMatchObject({
        gardenId: 1,
        raisedBedId: 11,
        uiContext: { surface: 'raised-bed' },
    });
});

test('approving a tool automatically continues the conversation', async ({
    mount,
    page,
}) => {
    await mockSuncokretRoutes(page);
    const requestBodies: Record<string, unknown>[] = [];
    await page.route('**/api/ai/suncokret/chat', async (route) => {
        const payload = route.request().postDataJSON() as Record<
            string,
            unknown
        >;
        requestBodies.push(payload);

        const chunks =
            requestBodies.length === 1
                ? [
                      { type: 'start', messageId: 'assistant-approval' },
                      { type: 'start-step' },
                      {
                          type: 'tool-input-available',
                          toolCallId: 'cart-call-1',
                          toolName: 'addProductToCart',
                          input: {
                              productId: 'plant-sort-458',
                              quantity: 1,
                              gardenId: 1,
                              raisedBedId: 11,
                              positionIndex: 0,
                          },
                      },
                      {
                          type: 'tool-approval-request',
                          approvalId: 'approval-1',
                          toolCallId: 'cart-call-1',
                      },
                      { type: 'finish-step' },
                      { type: 'finish', finishReason: 'tool-calls' },
                  ]
                : [
                      { type: 'start', messageId: 'assistant-result' },
                      { type: 'start-step' },
                      { type: 'text-start', id: 'text-1' },
                      {
                          type: 'text-delta',
                          id: 'text-1',
                          delta: 'Dodano u košaricu.',
                      },
                      { type: 'text-end', id: 'text-1' },
                      { type: 'finish-step' },
                      { type: 'finish', finishReason: 'stop' },
                  ];

        await route.fulfill({
            body: uiMessageStream(chunks),
            headers: {
                'content-type': 'text/event-stream',
                'x-vercel-ai-ui-message-stream': 'v1',
            },
        });
    });

    await mount(<SuncokretChatHudStory />);
    await page.getByRole('button', { name: 'Suncokret AI' }).click();
    await page.getByLabel('Pitaj Suncokret').fill('Dodaj bosiljak');
    await page.getByRole('button', { name: 'Pošalji' }).click();
    await page.getByRole('button', { name: 'Dopusti' }).click();

    await expect.poll(() => requestBodies.length).toBe(2);
    expect(JSON.stringify(requestBodies[1])).toContain('approval-responded');
});
