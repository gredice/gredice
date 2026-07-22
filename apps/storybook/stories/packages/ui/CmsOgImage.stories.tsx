import { CmsOgImage } from '@gredice/ui/cms';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const focalDemoImage = `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
        <rect width="1200" height="900" fill="#dce8d8" />
        <circle cx="950" cy="180" r="120" fill="#2e6f40" />
        <rect x="80" y="620" width="1040" height="180" rx="60" fill="#e8dccf" />
    </svg>
`)}`;

const meta = {
    title: 'packages/ui/CMS/CmsOgImage',
    component: CmsOgImage,
    tags: ['autodocs'],
    args: {
        imageUrl: focalDemoImage,
        kind: 'changelog',
        pointOfInterestX: 79,
        pointOfInterestY: 20,
        tags: ['Dostava', 'Narudžbe'],
        title: 'Pouzdanije praćenje dostave',
    },
    parameters: {
        layout: 'centered',
    },
    render: (args) => (
        <div className="aspect-[1200/630] w-[min(90vw,900px)] overflow-hidden rounded-md border">
            <CmsOgImage {...args} />
        </div>
    ),
} satisfies Meta<typeof CmsOgImage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PointOfInterest: Story = {};

export const LegacyCenterFallback: Story = {
    args: {
        pointOfInterestX: null,
        pointOfInterestY: null,
    },
};
