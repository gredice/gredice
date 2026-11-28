import { blockExpandCopy } from '@packages/game/blockOptions/blockOptionsCopy';
import {
    BlockExpandPanel,
    type BlockExpandPanelActions,
} from '@packages/game/blockOptions/expand/BlockExpandPanel';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';

const confirmActions = {
    kind: 'confirm',
    canConfirm: true,
    pending: false,
    onCancel: fn(),
    onConfirm: fn(),
} satisfies BlockExpandPanelActions;

const retryActions = {
    kind: 'retry',
    pending: false,
    onDiscard: fn(),
    onRetry: fn(),
} satisfies BlockExpandPanelActions;

const meta = {
    title: 'packages/game/hud/BlockExpandPanel',
    component: BlockExpandPanel,
    tags: ['autodocs'],
    args: {
        label: 'Trava',
        area: { width: 4, depth: 2 },
        count: 6,
        skippedCount: 0,
        total: 60,
        balance: 1250,
        status: null,
        alert: null,
        actions: confirmActions,
    },
    parameters: {
        docs: {
            description: {
                component:
                    'The Expand bar above the bottom HUD: how many see-through copies the marked area places, their total sunflower cost, the balance the sunflower HUD shows (balance minus the shopping cart) and the actions for the current step. `BlockExpandHud` decides the step: review, placing (the confirmed plan stays frozen), a lost response that can be checked again, and the receipt. It is a HUD game card with the Proširi medallion, a sunflower price chip and candy buttons, and it rises with a small overshoot.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="relative h-80 w-[40rem] max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border bg-gradient-to-b from-sky-100 to-lime-100 dark:from-sky-950 dark:to-lime-950">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof BlockExpandPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
    name: 'Only the source marked',
    args: {
        area: { width: 1, depth: 1 },
        count: 0,
        total: 0,
        status: blockExpandCopy.empty,
        actions: { ...confirmActions, canConfirm: false },
    },
};

export const Counting: Story = {
    name: 'Counting copies',
};

export const Skipped: Story = {
    name: 'Skipped cells',
    args: {
        area: { width: 5, depth: 3 },
        count: 11,
        skippedCount: 3,
        total: 110,
    },
};

export const AllSkipped: Story = {
    name: 'Every cell skipped',
    args: {
        area: { width: 3, depth: 1 },
        count: 0,
        skippedCount: 2,
        total: 0,
        status: blockExpandCopy.allSkipped,
        actions: { ...confirmActions, canConfirm: false },
    },
};

export const Cap: Story = {
    name: 'At the size cap',
    args: {
        label: 'Lopta za plažu',
        area: { width: 5, depth: 5 },
        count: 24,
        total: 720,
        balance: 1250,
        status: blockExpandCopy.cap(5),
    },
};

export const Short: Story = {
    name: 'Not enough sunflowers',
    args: {
        area: { width: 10, depth: 4 },
        count: 39,
        skippedCount: 0,
        total: 390,
        balance: 25,
        status: blockExpandCopy.short(2),
        actions: { ...confirmActions, canConfirm: false },
    },
};

export const NightOnly: Story = {
    name: 'Night-only block by day',
    args: {
        label: 'Mjesečeva bačva',
        area: { width: 3, depth: 2 },
        count: 5,
        total: 150,
        status: blockExpandCopy.nightOnly,
        actions: { ...confirmActions, canConfirm: false },
    },
};

export const Sandbox: Story = {
    name: 'Sandbox garden (free, no balance)',
    args: {
        total: 0,
        balance: null,
    },
};

export const Pending: Story = {
    name: 'Placing (frozen plan)',
    args: {
        skippedCount: 1,
        balance: 1190,
        actions: { ...confirmActions, canConfirm: false, pending: true },
    },
};

export const Conflict: Story = {
    name: 'Garden changed (409)',
    args: {
        count: 5,
        skippedCount: 2,
        total: 50,
        alert: blockExpandCopy.gardenChanged,
    },
};

export const RateLimited: Story = {
    name: 'Rate limited (429)',
    args: {
        alert: blockExpandCopy.rateLimited,
    },
};

export const Uncertain: Story = {
    name: 'Lost response: check the same request',
    args: {
        area: null,
        balance: null,
        alert: blockExpandCopy.uncertain,
        actions: retryActions,
    },
};

export const UncertainAgain: Story = {
    name: 'Lost response: lost again',
    args: {
        area: null,
        balance: null,
        status: blockExpandCopy.stillUncertain,
        alert: blockExpandCopy.uncertain,
        actions: retryActions,
    },
};

export const UncertainChecking: Story = {
    name: 'Lost response: checking',
    args: {
        area: null,
        balance: null,
        alert: blockExpandCopy.uncertain,
        actions: { ...retryActions, pending: true },
    },
};

export const Receipt: Story = {
    name: 'Receipt',
    args: {
        title: blockExpandCopy.receiptTitle('Trava'),
        area: null,
        balance: null,
        status: blockExpandCopy.success(6),
        actions: { kind: 'close', onClose: fn() },
    },
};

export const NotPlaced: Story = {
    name: 'Nothing placed (request answered after Expand closed)',
    args: {
        title: blockExpandCopy.receiptTitle('Trava'),
        area: null,
        balance: null,
        count: null,
        total: null,
        alert: blockExpandCopy.notPlaced,
        actions: { kind: 'close', onClose: fn() },
    },
};

export const NewExpandWithStoredRequest: Story = {
    name: 'New Expand while a lost request is stored',
    args: {
        label: 'Stablo',
        area: { width: 3, depth: 1 },
        count: 2,
        total: 40,
        status: blockExpandCopy.earlierPending,
        actions: { ...confirmActions, canConfirm: false },
        earlier: {
            label: 'Trava',
            count: 6,
            alert: blockExpandCopy.uncertain,
            actions: retryActions,
        },
    },
    decorators: [
        (Story) => (
            <div className="relative h-[28rem] w-[40rem] max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border bg-gradient-to-b from-sky-100 to-lime-100 dark:from-sky-950 dark:to-lime-950">
                <Story />
            </div>
        ),
    ],
};

export const NewExpandWithEarlierReceipt: Story = {
    name: 'New Expand after the stored request was placed',
    args: {
        label: 'Stablo',
        area: { width: 3, depth: 1 },
        count: 2,
        total: 40,
        earlier: {
            label: 'Trava',
            count: 6,
            status: blockExpandCopy.success(6),
            actions: { kind: 'close', onClose: fn() },
        },
    },
    decorators: NewExpandWithStoredRequest.decorators,
};

export const LongLabel: Story = {
    name: 'Long block name',
    args: {
        label: 'Polirana kamena staza s rubom od mahovine',
        area: { width: 10, depth: 10 },
        count: 99,
        total: 1485,
        balance: 12_500,
        status: blockExpandCopy.cap(10),
    },
};

export const Phone: Story = {
    name: '360 px phone',
    args: {
        skippedCount: 1,
        status: blockExpandCopy.short(2),
        balance: 25,
        actions: { ...confirmActions, canConfirm: false },
    },
    decorators: [
        (Story) => (
            <div className="relative h-80 w-[360px] overflow-hidden border-r border-dashed">
                <Story />
            </div>
        ),
    ],
};

export const Dark: Story = {
    name: 'Dark',
    args: {
        skippedCount: 1,
        alert: blockExpandCopy.gardenChanged,
    },
    decorators: [
        (Story) => (
            <div className="dark absolute inset-0 bg-background text-foreground">
                <Story />
            </div>
        ),
    ],
};
