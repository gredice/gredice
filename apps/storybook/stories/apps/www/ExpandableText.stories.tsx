import { ExpandableText } from '@apps/www/components/shared/ExpandableText';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/www/Shared/ExpandableText',
    component: ExpandableText,
    tags: ['autodocs'],
    args: {
        children: null,
        collapseButtonText: 'Show less',
        expandButtonText: 'Show more',
        maxHeight: 96,
    },
    render: (args) => (
        <div className="max-w-xl">
            <ExpandableText {...args}>
                <div className="space-y-3 text-sm leading-6 text-foreground">
                    <p>
                        Gredice combines planning, automation, and practical
                        guidance for modular gardens. This example keeps the
                        content intentionally long enough to demonstrate the
                        collapsed state.
                    </p>
                    <p>
                        Use this component when public website pages need a
                        compact preview that expands into richer editorial
                        content without navigating away from the current page.
                    </p>
                </div>
            </ExpandableText>
        </div>
    ),
} satisfies Meta<typeof ExpandableText>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
