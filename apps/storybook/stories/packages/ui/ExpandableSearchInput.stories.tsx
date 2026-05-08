import { ExpandableSearchInput } from '@gredice/ui/ExpandableSearchInput';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

const meta = {
    title: 'packages/ui/Inputs/ExpandableSearchInput',
    component: ExpandableSearchInput,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Responsive search input that renders as a plain icon button on mobile and expands into an input popover, while staying a regular input on desktop.',
            },
        },
    },
    args: {
        placeholder: 'Pretraži...',
    },
    render: (args) => {
        const [value, setValue] = useState('');

        return (
            <div className="w-full max-w-sm">
                <ExpandableSearchInput
                    {...args}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    inputClassName="min-w-60"
                />
            </div>
        );
    },
} satisfies Meta<typeof ExpandableSearchInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
