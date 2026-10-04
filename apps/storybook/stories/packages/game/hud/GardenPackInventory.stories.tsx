import { GardenPackInventoryPurchase } from '@packages/game/hud/GardenPackInventoryPurchase';
import { getLocalSandboxBlockData } from '@packages/game/localSandboxBlockData';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { createOwnedGardenPackFixture } from '../../../../../../packages/game/tests/ownedGardenPackFixture';

const pack = createOwnedGardenPackFixture(
    '8c113518-b998-4fcf-9904-85d58f3fa234',
);
const blockData = getLocalSandboxBlockData().map((block) =>
    block.information.name === pack.lines[0]?.modelName
        ? { ...block, id: 801 }
        : block,
);
const meta = {
    title: 'packages/game/hud/GardenPackInventory',
    component: GardenPackInventoryPurchase,
    tags: ['autodocs'],
    args: { pack, blockData, onPlaced: () => {} },
    decorators: [
        (Story) => (
            <div className="max-w-sm bg-background p-4">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof GardenPackInventoryPurchase>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PartlyUsed: Story = {};
export const Unopened: Story = {
    args: {
        pack: {
            ...pack,
            remainingQuantity: 3,
            lines: pack.lines.map((line) => ({
                ...line,
                remainingQuantity: 3,
                availableUnitOrdinals: [1, 2, 3],
            })),
        },
    },
};
export const Exhausted: Story = {
    args: {
        pack: {
            ...pack,
            remainingQuantity: 0,
            lines: pack.lines.map((line) => ({
                ...line,
                remainingQuantity: 0,
                availableUnitOrdinals: [],
            })),
        },
    },
};
export const MissingAsset: Story = { args: { blockData: [] } };
export const UnsupportedAppearance: Story = {
    args: {
        pack: {
            ...pack,
            lines: pack.lines.map((line) => ({
                ...line,
                variant: {
                    versionId: 'unavailable-v1',
                    appearance: { id: 'unavailable' },
                },
            })),
        },
    },
};
export const PlacementFailure: Story = {
    args: {
        placement: {
            place: async () => {
                throw new Error('Fixture rejection');
            },
            isPending: false,
            error: new Error('Fixture rejection'),
        },
    },
};
