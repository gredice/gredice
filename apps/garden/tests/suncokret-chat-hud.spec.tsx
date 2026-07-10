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
        usedInputTokens: 800,
        usedOutputTokens: 434,
        usedTotalTokens: 1_234,
    },
};

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

test('production chat hides developer controls and shows token usage', async ({
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
    await expect(chat).toContainText('Razgovor za Sunčano Sunce');
    await expect(chat).toContainText('Danas korišteno');
    await expect(chat).not.toContainText('USD');
    await expect(chat).not.toContainText('AI vrtni pomoćnik');
    await expect(page.getByLabel('AI model')).toHaveCount(0);
    expect(modelRequests).toBe(0);
    await expect(chat).toHaveClass(/border-b-amber-400/);
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
