import { RaisedBedAddons } from '@gredice/ui/raisedBeds';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { raisedBedAddonFixture } from '../../../../../packages/ui/src/raisedBeds/RaisedBedFieldsGrid.fixture';

const meta = {
    title: 'UI/Raised beds/Addons',
    component: RaisedBedAddons,
    args: { addons: raisedBedAddonFixture, fieldCount: 9 },
} satisfies Meta<typeof RaisedBedAddons>;
export default meta;
type Story = StoryObj<typeof meta>;
export const WholeBed: Story = {};
export const FieldWithPendingSupport: Story = { args: { position: 8 } };
export const Empty: Story = { args: { addons: [] } };
export const PartialBedCoverage: Story = {
    args: {
        addons: raisedBedAddonFixture
            .filter((addon) => addon.scope === 'raisedBed')
            .map((addon) => ({
                ...addon,
                positionNumbers: [1, 3, 4, 5, 7, 9],
            })),
    },
};
