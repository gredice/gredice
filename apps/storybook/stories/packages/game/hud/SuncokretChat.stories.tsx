import { SuncokretChatHudStory } from '@apps/garden/tests/SuncokretChatHudStory';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';

const meta = {
    title: 'Game/Suncokret chat',
    component: SuncokretChatHudStory,
    parameters: { layout: 'fullscreen' },
    args: { review: true },
    beforeEach: (context) => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async (input, init) => {
            const url = String(input instanceof Request ? input.url : input);
            if (!url.includes('/api/ai/suncokret/'))
                return originalFetch(input, init);
            if (url.includes('/status'))
                return Response.json({
                    enabled: true,
                    model: null,
                    limit: { blockedReason: null },
                });
            if (url.includes('/conversations/')) {
                if (context.parameters.historyError)
                    return Response.json({}, { status: 503 });
                if (!context.parameters.saved)
                    return Response.json({}, { status: 404 });
                const id = 'analysis-501-review-user';
                return Response.json({
                    conversation: {
                        id,
                        title: 'Savjeti za grah',
                        model: null,
                        gardenId: 1,
                        raisedBedId: 11,
                        createdAt: '2026-09-22T12:00:00Z',
                        lastMessageAt: null,
                        messages: [
                            {
                                id: `${id}-0`,
                                role: 'assistant',
                                parts: [
                                    {
                                        type: 'text',
                                        text: 'Grah ima zrele mahune.',
                                    },
                                ],
                            },
                            {
                                id: 'question',
                                role: 'user',
                                parts: [
                                    {
                                        type: 'text',
                                        text: 'Kada da uberem grah?',
                                    },
                                ],
                            },
                            {
                                id: 'answer',
                                role: 'assistant',
                                parts: [
                                    {
                                        type: 'text',
                                        text: 'Uberi samo zrele mahune. Ostale ostavi da nastave rasti.',
                                    },
                                ],
                            },
                        ],
                    },
                });
            }
            // Stories are previews and never send real AI requests.
            return Response.json(
                { error: 'Ovo je prikaz razgovora.' },
                { status: 503 },
            );
        };
        return () => {
            globalThis.fetch = originalFetch;
        };
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await userEvent.click(
            canvas.getByRole('button', {
                name: 'Pregledaj savjete suncokreta',
            }),
        );
        await expect(
            within(canvasElement.ownerDocument.body).getByRole('dialog', {
                name: 'AI analiza fotografije',
            }),
        ).toBeVisible();
    },
} satisfies Meta<typeof SuncokretChatHudStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Review: Story = {};
export const SavedDiscussion: Story = { parameters: { saved: true } };
export const HistoryUnavailable: Story = { parameters: { historyError: true } };
export const Mobile: Story = { globals: { viewport: { value: 'mobile1' } } };
