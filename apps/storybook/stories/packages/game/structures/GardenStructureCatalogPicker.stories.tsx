import {
    GardenStructureCatalogPicker,
    gardenStructureKitV1Catalog,
} from '@gredice/game/garden-structure-catalog';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/game/Structures/GardenStructureCatalogPicker',
    component: GardenStructureCatalogPicker,
    tags: ['autodocs'],
    args: {
        ariaLabel: 'Predložak građevine',
        entries: gardenStructureKitV1Catalog.templates,
        onSelectionChange: () => undefined,
        selectedId: 'house',
    },
    parameters: {
        docs: {
            description: {
                component:
                    'Mobile-first static-image palette with native radio keyboard behavior and touch-sized labels. Catalogue cards never mount their own WebGL canvas.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="mx-auto max-w-md bg-background p-4 text-foreground">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof GardenStructureCatalogPicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Templates: Story = {};

export const EdgePartsWithOpenChoice: Story = {
    args: {
        ariaLabel: 'Južni rub polja',
        emptyLabel: 'Otvoreno',
        entries: gardenStructureKitV1Catalog.parts.filter(
            (entry) => entry.category === 'edge',
        ),
        selectedId: 'door.house-open',
    },
};

export const RoofMaterials: Story = {
    args: {
        ariaLabel: 'Materijal krova',
        entries: gardenStructureKitV1Catalog.materials.filter((entry) =>
            entry.id.startsWith('roof.'),
        ),
        selectedId: 'roof.clay',
    },
};

export const Disabled: Story = {
    args: {
        disabled: true,
    },
};

export const ConstrainedMobileWidth: Story = {
    decorators: [
        (Story) => (
            <div className="w-[320px] bg-background p-3 text-foreground">
                <Story />
            </div>
        ),
    ],
};
