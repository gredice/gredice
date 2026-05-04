import { Logotype } from '@apps/www/components/Logotype';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/www/Brand/Logotype',
    component: Logotype,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'The public website Logotype renders the Gredice brand mark for headers, footers, and marketing surfaces.',
            },
        },
    },
    args: {
        className: 'h-12 w-auto',
    },
} satisfies Meta<typeof Logotype>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
