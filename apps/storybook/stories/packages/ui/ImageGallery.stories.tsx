import { ImageGallery } from '@gredice/ui/ImageGallery';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const largeImageSvg = encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="3000" viewBox="0 0 4000 3000"><rect width="4000" height="3000" fill="#2f7d46"/><circle cx="2000" cy="1500" r="900" fill="#f7d04a"/><text x="2000" y="1540" text-anchor="middle" font-size="240" font-family="Arial" fill="#1f2937">4000 x 3000</text></svg>',
);
const largeImageSrc = `data:image/svg+xml,${largeImageSvg}`;

const wideImageSvg = encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="900" viewBox="0 0 2400 900"><defs><linearGradient id="sky" x1="0" x2="1"><stop stop-color="#86b6d6"/><stop offset="1" stop-color="#f4c56a"/></linearGradient></defs><rect width="2400" height="900" fill="url(#sky)"/><rect y="520" width="2400" height="380" fill="#4f7d45"/><path d="M0 610 C360 470 680 700 1040 560 S1750 520 2400 610" fill="#8db15d"/><text x="1200" y="450" text-anchor="middle" font-size="120" font-family="Arial" fill="#1f2937">2400 x 900 panorama</text></svg>',
);
const wideImageSrc = `data:image/svg+xml,${wideImageSvg}`;

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

export const WideImage: Story = {
    args: {
        images: [
            {
                src: wideImageSrc,
                alt: 'Wide garden panorama',
            },
        ],
    },
};

export const NoImages: Story = {
    args: {
        images: [],
    },
};
