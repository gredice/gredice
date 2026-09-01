import { GardenStructureFootprintInspector } from '@gredice/game';
import {
    createGardenStructureTemplateSeed,
    type GardenStructureDocumentV1,
    gardenStructureCellKey,
    gardenStructureSchemaVersion,
} from '@gredice/js/gardenStructures';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const houseDocument = createGardenStructureTemplateSeed('house').document;
const blankDocument = createGardenStructureTemplateSeed('blank').document;

function footprintDocument(width: number, depth: number) {
    const cells: GardenStructureDocumentV1['footprint']['cells'][number][] = [];
    for (let y = 0; y < depth; y += 1) {
        for (let x = 0; x < width; x += 1) {
            cells.push({
                x,
                y,
                spaceKind: y === depth - 1 ? 'covered-outdoor' : 'interior',
            });
        }
    }
    return {
        schemaVersion: gardenStructureSchemaVersion,
        footprint: { cells },
        floors: [],
        edges: [],
        roofRegions: [],
        props: [],
    } satisfies GardenStructureDocumentV1;
}

const meta = {
    title: 'packages/game/structures/GardenStructureFootprintInspector',
    component: GardenStructureFootprintInspector,
    tags: ['autodocs'],
    args: {
        addSpaceKind: 'interior',
        document: houseDocument,
        onAddCell: () => undefined,
        onAddSpaceKindChange: () => undefined,
        onRemoveCell: () => undefined,
        onSelectedCellKeyChange: () => undefined,
        onSetSpaceKind: () => undefined,
        selectedCellKey: gardenStructureCellKey({ x: 0, y: 0 }),
    },
    parameters: {
        docs: {
            description: {
                component:
                    'Touch-first and keyboard-accessible footprint inspector used alongside the Garden canvas in Structure Build Mode.',
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
} satisfies Meta<typeof GardenStructureFootprintInspector>;

export default meta;

type Story = StoryObj<typeof meta>;

export const HouseWithOpenPorch: Story = {};

export const ConstrainedMobileWidth: Story = {
    decorators: [
        (Story) => (
            <div className="min-h-screen max-w-[390px] bg-background p-3 text-foreground">
                <Story />
            </div>
        ),
    ],
};

export const BlankSeed: Story = {
    args: {
        document: blankDocument,
        selectedCellKey: null,
    },
};

export const MaximumFootprint: Story = {
    args: {
        document: footprintDocument(20, 5),
        selectedCellKey: gardenStructureCellKey({ x: 19, y: 4 }),
    },
};

export const DisabledWhileSaving: Story = {
    args: {
        disabled: true,
    },
};

export const ValidationError: Story = {
    args: {
        error: 'Uklanjanje tog polja odvojilo bi tlocrt na dva dijela.',
    },
};

export const EmptyRecoveryFallback: Story = {
    args: {
        document: {
            ...blankDocument,
            footprint: { cells: [] },
        },
        selectedCellKey: null,
    },
};
