import { ImageViewer } from '@gredice/ui/ImageViewer';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Media/ImageViewer',
    component: ImageViewer,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'ImageViewer renders an image preview that can open a larger viewer while preserving alt text and preview dimensions.',
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
