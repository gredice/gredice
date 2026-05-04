import { ImageGallery } from '@gredice/ui/ImageGallery';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

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
                    'ImageGallery presents one or more images with configurable preview sizing and carousel or stacked preview layouts.',
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

export const NoImages: Story = {
    args: {
        images: [],
    },
};
