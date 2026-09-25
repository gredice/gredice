import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AutumnVisualFixture } from '../../../../../packages/game/tests/AutumnVisualFixture';

const meta = {
    title: 'packages/game/Autumn',
    component: AutumnVisualFixture,
} satisfies Meta<typeof AutumnVisualFixture>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Summer: Story = { args: { stage: 'summer' } };
export const YellowingStarts: Story = { args: { calendarDate: [2024, 8, 22] } };
export const SeptemberGradient: Story = {
    args: { calendarDate: [2024, 9, 10] },
};
export const EarlyAutumn: Story = { args: { stage: 'earlyAutumn' } };
export const MidAutumn: Story = { args: { stage: 'midAutumn' } };
export const LateAutumn: Story = { args: { stage: 'lateAutumn' } };
export const Winter: Story = { args: { stage: 'winter', snow: 0.7 } };
