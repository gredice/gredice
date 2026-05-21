import { Gallery, type GalleryItem } from '@gredice/ui/Gallery';
import { Input } from '@gredice/ui/Input';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

type ExampleGalleryItem = GalleryItem & {
    label: string;
    description: string;
};

const items: ExampleGalleryItem[] = [
    {
        id: 'tomato',
        label: 'Rajcica',
        description: 'Topla sezona',
    },
    {
        id: 'lettuce',
        label: 'Salata',
        description: 'Brzi ciklus',
    },
    {
        id: 'pepper',
        label: 'Paprika',
        description: 'Dugo dozrijevanje',
    },
];

function GalleryCard({ label, description }: ExampleGalleryItem) {
    return (
        <Stack className="rounded-lg border bg-card p-3" spacing={2}>
            <Typography semiBold>{label}</Typography>
            <Typography level="body3" secondary>
                {description}
            </Typography>
        </Stack>
    );
}

const meta = {
    title: 'packages/ui/Data Display/Gallery',
    component: Gallery,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Gallery provides the public-site grid and optional filter column used for plants, blocks, and similar catalog pages.',
            },
        },
    },
    args: {
        items,
        itemComponent: GalleryCard,
        gridHeader: 'Biljke',
    },
    render: (args) => <Gallery {...args} />,
} satisfies Meta<typeof Gallery<ExampleGalleryItem>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithFilters: Story = {
    args: {
        filters: () => (
            <Stack spacing={2}>
                <Typography level="body3" secondary>
                    Filter
                </Typography>
                <Input placeholder="Pretraga" />
            </Stack>
        ),
    },
};
