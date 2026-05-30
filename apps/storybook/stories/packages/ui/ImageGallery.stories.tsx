import { ImageGallery } from '@gredice/ui/ImageGallery';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const largeImageSvg = encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="3000" viewBox="0 0 4000 3000"><rect width="4000" height="3000" fill="#2f7d46"/><circle cx="2000" cy="1500" r="900" fill="#f7d04a"/><text x="2000" y="1540" text-anchor="middle" font-size="240" font-family="Arial" fill="#1f2937">4000 x 3000</text></svg>',
);
const largeImageSrc = `data:image/svg+xml,${largeImageSvg}`;

const sampleImages = [
    {
        src: 'https://cdn.gredice.com/sunflower-sad-500x500.png',
        alt: 'Suncokret',
    },
    {
        src: 'https://cdn.gredice.com/avatars/farmer-male.png',
        alt: 'Farmer',
    },
    {
        src: 'https://cdn.gredice.com/avatars/farmer-female.png',
        alt: 'Farmerka',
    },
];

const meta = {
    title: 'packages/ui/Media/ImageGallery',
    component: ImageGallery,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'ImageGallery presents one or more images with configurable previews and a fit-to-screen expanded gallery.',
            },
        },
    },
    args: {
        images: sampleImages,
        previewWidth: 300,
        previewHeight: 200,
        previewAs: 'button',
        previewVariant: 'carousel',
    },
} satisfies Meta<typeof ImageGallery>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Carousel: Story = {};

export const Stacked: Story = {
    args: {
        previewVariant: 'stacked',
    },
};

export const SingleImage: Story = {
    args: {
        images: [sampleImages[0]],
    },
};

export const LargeImage: Story = {
    args: {
        images: [
            {
                src: largeImageSrc,
                alt: 'Large garden image',
            },
        ],
    },
};

export const NoImages: Story = {
    args: {
        images: [],
    },
};
