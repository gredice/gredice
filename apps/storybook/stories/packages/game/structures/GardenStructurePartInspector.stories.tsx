import {
    GardenStructurePartInspector,
    type GardenStructurePartInspectorProps,
} from '@gredice/game';
import {
    createGardenStructureTemplateSeed,
    getGardenStructureKitReferenceDefinition,
} from '@gredice/js/gardenStructures';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const houseDocument = createGardenStructureTemplateSeed('house').document;
const kit = getGardenStructureKitReferenceDefinition('gredice-buildings', '1');

if (!kit) {
    throw new Error('The documented garden structure kit is unavailable.');
}

const callbacks = {
    onAddProp: () => undefined,
    onDeleteProp: () => undefined,
    onDuplicateProp: () => undefined,
    onMoveProp: () => undefined,
    onRemoveEdgePart: () => undefined,
    onRemoveFloorMaterial: () => undefined,
    onRemoveRoofCoverage: () => undefined,
    onRotateProp: () => undefined,
    onSetEdgePart: () => undefined,
    onSetFloorMaterial: () => undefined,
    onSetRoofCoverage: () => undefined,
} satisfies Pick<
    GardenStructurePartInspectorProps,
    | 'onAddProp'
    | 'onDeleteProp'
    | 'onDuplicateProp'
    | 'onMoveProp'
    | 'onRemoveEdgePart'
    | 'onRemoveFloorMaterial'
    | 'onRemoveRoofCoverage'
    | 'onRotateProp'
    | 'onSetEdgePart'
    | 'onSetFloorMaterial'
    | 'onSetRoofCoverage'
>;

const meta = {
    title: 'packages/game/structures/GardenStructurePartInspector',
    component: GardenStructurePartInspector,
    tags: ['autodocs'],
    args: {
        ...callbacks,
        document: houseDocument,
        kit,
        selectedCellKey: '1|1',
    },
    parameters: {
        docs: {
            description: {
                component:
                    'Mobile-first inspector for editing the floor, edges, roof, and semantic props of one selected Structure Build Mode cell.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="mx-auto min-h-screen max-w-2xl bg-background p-4 text-foreground">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof GardenStructurePartInspector>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SelectedHouseCell: Story = {};

export const ConstrainedMobileWidth: Story = {
    decorators: [
        (Story) => (
            <div className="min-h-screen max-w-[360px] bg-background p-3 text-foreground">
                <Story />
            </div>
        ),
    ],
};

export const Loading: Story = {
    args: {
        loading: true,
    },
};

export const EmptySelection: Story = {
    args: {
        selectedCellKey: null,
    },
};

export const DisabledWhileSaving: Story = {
    args: {
        disabled: true,
    },
};

export const ValidationError: Story = {
    args: {
        error: 'Odabrani prozor nije dostupan u ovoj verziji građevinskog kompleta.',
    },
};
