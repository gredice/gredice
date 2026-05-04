import { Logotype } from '@apps/garden/components/Logotype';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/garden/Brand/Logotype',
    component: Logotype,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'The garden Logotype renders the Vrt Gredice brand mark with configurable sizing and color for garden-facing surfaces.',
            },
        },
    },
    args: {
        className: 'h-12 w-auto',
        color: '#2E6F40',
    },
} satisfies Meta<typeof Logotype>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
