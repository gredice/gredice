import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { AchievementCollectionShowcase } from '../../../../../../packages/game/src/shared-ui/achievements/AchievementCollection.fixture';

const meta = {
    title: 'packages/game/Achievements/Collection',
    component: AchievementCollectionShowcase,
    tags: ['autodocs'],
    parameters: { layout: 'fullscreen' },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await expect(
            canvasElement.querySelectorAll('[data-achievement-family]'),
        ).toHaveLength(5);
        await userEvent.click(canvas.getByRole('button', { name: /^Sadnja/ }));
        const dialog = await within(
            canvasElement.ownerDocument.body,
        ).findByRole('dialog', { name: 'Sadnja' });
        await expect(
            dialog.querySelectorAll('[data-achievement-level]'),
        ).toHaveLength(9);
        await userEvent.keyboard('{Escape}');
    },
} satisfies Meta<typeof AchievementCollectionShowcase>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Experienced: Story = {};
export const Starter: Story = { args: { state: 'starter' } };
export const Empty: Story = { args: { state: 'empty' } };
export const Complete: Story = { args: { state: 'complete' } };
export const Dark: Story = { args: { dark: true } };
