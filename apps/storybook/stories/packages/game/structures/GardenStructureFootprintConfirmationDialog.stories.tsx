import { GardenStructureFootprintConfirmationDialog } from '@gredice/game';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/game/structures/GardenStructureFootprintConfirmationDialog',
    component: GardenStructureFootprintConfirmationDialog,
    tags: ['autodocs'],
    args: {
        depth: 8,
        isSandbox: false,
        onCancel: () => undefined,
        onConfirm: () => undefined,
        pricing: {
            cellCount: 63,
            maximumCellCount: 100,
            totalPrice: 3_150,
            delta: {
                cellDelta: 11,
                debit: 550,
                nextRefundablePrincipal: 3_150,
                refund: 0,
            },
        },
        width: 9,
    },
    parameters: {
        docs: {
            description: {
                component:
                    'Explicit confirmation for a footprint resize, including the exact capacity, dimensions, total value, debit, and refund before the staged command is committed.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="relative min-h-[640px] bg-muted/30 p-4">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof GardenStructureFootprintConfirmationDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PaidResize: Story = {};

export const Refund: Story = {
    args: {
        pricing: {
            cellCount: 30,
            maximumCellCount: 100,
            totalPrice: 1_500,
            delta: {
                cellDelta: -12,
                debit: 0,
                nextRefundablePrincipal: 1_500,
                refund: 600,
            },
        },
        width: 6,
        depth: 5,
    },
};

export const SandboxResize: Story = {
    args: {
        isSandbox: true,
    },
};

export const ValidationError: Story = {
    args: {
        error: 'Tlocrt se promijenio dok je potvrda bila otvorena.',
    },
};
