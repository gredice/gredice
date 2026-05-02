import { ArchiveIcon } from '@gredice/ui/ArchiveIcon';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Icons/ArchiveIcon',
    component: ArchiveIcon,
    tags: ['autodocs'],
    args: {
        className: 'size-8 text-primary',
    },
} satisfies Meta<typeof ArchiveIcon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
