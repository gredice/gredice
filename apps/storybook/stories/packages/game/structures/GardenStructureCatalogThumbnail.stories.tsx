import {
    GardenStructureCatalogThumbnail,
    gardenStructureKitV1Catalog,
} from '@gredice/game/garden-structure-catalog';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/game/Structures/GardenStructureCatalogThumbnail',
    component: GardenStructureCatalogThumbnail,
    tags: ['autodocs'],
    args: {
        entry: gardenStructureKitV1Catalog.templates[1],
        loading: 'eager',
    },
    parameters: {
        docs: {
            description: {
                component:
                    'Static, versioned WebP media for structure template and part pickers; it never creates a per-card 3D canvas.',
            },
        },
        layout: 'fullscreen',
    },
} satisfies Meta<typeof GardenStructureCatalogThumbnail>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TemplateChooser: Story = {
    render: () => (
        <div
            style={{
                boxSizing: 'border-box',
                display: 'grid',
                gap: 12,
                gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
                maxWidth: 640,
                padding: 16,
                width: '100%',
            }}
        >
            {gardenStructureKitV1Catalog.templates.map((entry, index) => (
                <button
                    aria-pressed={index === 1}
                    key={entry.key}
                    style={{
                        alignItems: 'center',
                        background: index === 1 ? '#f0f7eb' : '#ffffff',
                        border: `2px solid ${index === 1 ? '#60864c' : '#d5ddcf'}`,
                        borderRadius: 14,
                        color: '#24311f',
                        display: 'flex',
                        flexDirection: 'column',
                        font: 'inherit',
                        gap: 8,
                        minWidth: 0,
                        padding: 10,
                    }}
                    type="button"
                >
                    <GardenStructureCatalogThumbnail alt="" entry={entry} />
                    <span>{entry.label}</span>
                </button>
            ))}
        </div>
    ),
};

export const PartPalette: Story = {
    render: () => (
        <div
            style={{
                boxSizing: 'border-box',
                display: 'grid',
                gap: 8,
                gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))',
                maxWidth: 720,
                padding: 16,
                width: '100%',
            }}
        >
            {gardenStructureKitV1Catalog.parts.map((entry) => (
                <button
                    key={entry.key}
                    style={{
                        background: '#ffffff',
                        border: '1px solid #d5ddcf',
                        borderRadius: 10,
                        color: '#24311f',
                        font: 'inherit',
                        minWidth: 0,
                        padding: 8,
                    }}
                    type="button"
                >
                    <GardenStructureCatalogThumbnail
                        alt=""
                        entry={entry}
                        style={{
                            height: 72,
                            objectFit: 'contain',
                            width: '100%',
                        }}
                    />
                    <span>{entry.label}</span>
                </button>
            ))}
        </div>
    ),
};

export const MaterialPalette: Story = {
    render: () => (
        <div
            style={{
                boxSizing: 'border-box',
                display: 'grid',
                gap: 8,
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                maxWidth: 720,
                padding: 16,
                width: '100%',
            }}
        >
            {gardenStructureKitV1Catalog.materials.map((entry) => (
                <div
                    key={entry.key}
                    style={{
                        alignItems: 'center',
                        border: '1px solid #d5ddcf',
                        borderRadius: 10,
                        color: '#24311f',
                        display: 'flex',
                        gap: 8,
                        minWidth: 0,
                        padding: 8,
                    }}
                >
                    <GardenStructureCatalogThumbnail entry={entry} />
                    <span>{entry.label}</span>
                </div>
            ))}
        </div>
    ),
};
