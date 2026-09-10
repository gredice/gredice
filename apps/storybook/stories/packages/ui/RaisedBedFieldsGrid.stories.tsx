import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RaisedBedFieldsGridFixture } from '../../../../../packages/ui/src/raisedBeds/RaisedBedFieldsGrid.fixture';

const meta = {
    title: 'UI/Raised beds/Fields',
    component: RaisedBedFieldsGridFixture,
    parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof RaisedBedFieldsGridFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MixedPlantings: Story = {};

export const Mobile: Story = {
    globals: { viewport: { value: 'mobile1', isRotated: false } },
};
