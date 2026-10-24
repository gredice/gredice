import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SeasonDateControlFixture } from '../../../../../garden/tests/SeasonDateControlFixture';

const meta = {
    title: 'packages/game/hud/SeasonDateControl',
    component: SeasonDateControlFixture,
} satisfies Meta<typeof SeasonDateControlFixture>;
export default meta;
type Story = StoryObj<typeof meta>;
export const LeapYear: Story = {};
export const DebugDisabled: Story = { args: { enabled: false } };
