import { ImageViewer } from '@gredice/ui/ImageViewer';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const largeImageSvg = encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="3000" viewBox="0 0 4000 3000"><rect width="4000" height="3000" fill="#2f7d46"/><circle cx="2000" cy="1500" r="900" fill="#f7d04a"/><text x="2000" y="1540" text-anchor="middle" font-size="240" font-family="Arial" fill="#1f2937">4000 x 3000</text></svg>',
);
const largeImageSrc = `data:image/svg+xml,${largeImageSvg}`;

const meta = {
    title: 'packages/ui/Media/ImageViewer',
    component: ImageViewer,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'ImageViewer renders an image preview that opens a fit-to-screen viewer while preserving alt text and preview dimensions.',
            },
        },
    },
    args: {
        src: 'https://cdn.gredice.com/sunflower-sad-500x500.png',
        alt: 'Sunflower',
        previewWidth: 300,
        previewHeight: 300,
        previewAs: 'button',
    },
} satisfies Meta<typeof ImageViewer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SmallPreview: Story = {
    args: {
        previewWidth: 120,
        previewHeight: 120,
    },
};

export const LargeImage: Story = {
    args: {
        src: largeImageSrc,
        alt: 'Large garden image',
    },
};

export const AsDiv: Story = {
    args: {
        previewAs: 'div',
    },
    render: (args) => (
        <button type="button" className="border rounded-lg p-2">
            <ImageViewer {...args} />
        </button>
    ),
};
