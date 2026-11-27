import { BlockOptionsToolbar } from '@packages/game/blockOptions/BlockOptionsToolbar';
import type { BlockOptionsAction } from '@packages/game/blockOptions/blockOptionsActions';
import { blockOptionsToolbarCopy } from '@packages/game/blockOptions/blockOptionsCopy';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';

const { actions: labels, disabledReasons } = blockOptionsToolbarCopy;

function createActions(
    overrides: Partial<
        Record<BlockOptionsAction['id'], Partial<BlockOptionsAction>>
    > = {},
): BlockOptionsAction[] {
    const base: BlockOptionsAction[] = [
        { id: 'expand', label: labels.expand, disabledReason: null },
        { id: 'rotate', label: labels.rotate, disabledReason: null },
        { id: 'remove', label: labels.recycle, disabledReason: null },
        { id: 'move', label: labels.move, disabledReason: null },
    ];
    return base.map((action) => ({ ...action, ...overrides[action.id] }));
}

const meta = {
    title: 'packages/game/hud/BlockOptionsToolbar',
    component: BlockOptionsToolbar,
    tags: ['autodocs'],
    args: {
        label: 'Lopta za plažu',
        actions: createActions(),
        status: null,
        side: 'above',
        onAction: fn(),
        onMovePointerDown: fn(),
    },
    parameters: {
        docs: {
            description: {
                component:
                    'The pop-up that opens next to a placed block when the player holds it and lets go without moving: Proširi, Okreni, Recikliraj (Obriši in sandbox gardens) and Pomakni. Unavailable tiles stay pressable (`aria-disabled`); a tap writes the reason to the status line under the tiles. In the game, `BlockOptionsPopupLayer` places the bubble beside the block, clear of the HUD, and points the tail at it.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="flex min-h-56 w-[36rem] max-w-[calc(100vw-3rem)] items-center justify-center rounded-xl border bg-gradient-to-b from-sky-100 to-lime-100 p-10 dark:from-sky-950 dark:to-lime-950">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof BlockOptionsToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    name: 'All actions available',
};

export const DisabledWithReason: Story = {
    name: 'Unavailable tiles, reason shown',
    args: {
        label: 'Gredica',
        actions: createActions({
            expand: { disabledReason: disabledReasons.notExpandable },
            rotate: { disabledReason: disabledReasons.notRotatable },
            remove: { disabledReason: disabledReasons.activeRaisedBed },
        }),
        status: { kind: 'status', message: disabledReasons.notRotatable },
    },
};

export const Sandbox: Story = {
    name: 'Sandbox garden (Obriši)',
    args: {
        label: 'Grm',
        actions: createActions({ remove: { label: labels.delete } }),
    },
};

export const Saving: Story = {
    name: 'Unsaved block',
    args: {
        label: 'Grm',
        actions: createActions({
            expand: { disabledReason: disabledReasons.unsaved },
            rotate: { disabledReason: disabledReasons.unsaved },
            remove: { disabledReason: disabledReasons.unsaved },
            move: { disabledReason: disabledReasons.unsaved },
        }),
        status: { kind: 'status', message: disabledReasons.unsaved },
    },
};

export const LongLabel: Story = {
    name: 'Long block label, rotate error',
    args: {
        label: 'Polirana kamena staza s rubom od mahovine',
        status: {
            kind: 'alert',
            message:
                'Za okretanje predmeta potrebna su dva slobodna polja na istoj visini.',
        },
    },
};

export const Below: Story = {
    name: 'Placed below the block',
    args: {
        side: 'below',
        tailOffset: 48,
    },
};

export const Phone: Story = {
    name: '360 px phone',
    args: {
        status: { kind: 'status', message: disabledReasons.expandPending },
        actions: createActions({
            expand: { disabledReason: disabledReasons.expandPending },
            rotate: { disabledReason: disabledReasons.expandPending },
            remove: { disabledReason: disabledReasons.expandPending },
            move: { disabledReason: disabledReasons.expandPending },
        }),
    },
    decorators: [
        (Story) => (
            <div className="flex h-72 w-[360px] items-center justify-center overflow-hidden border-r border-dashed bg-gradient-to-b from-sky-100 to-lime-100 px-2 dark:from-sky-950 dark:to-lime-950">
                <Story />
            </div>
        ),
    ],
};

export const Dark: Story = {
    name: 'Dark',
    args: {
        actions: createActions({
            expand: { disabledReason: disabledReasons.notExpandable },
        }),
        status: { kind: 'status', message: disabledReasons.notExpandable },
    },
    decorators: [
        (Story) => (
            <div className="dark rounded-xl bg-background p-10 text-foreground">
                <Story />
            </div>
        ),
    ],
};
