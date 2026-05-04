import { Markdown } from '@gredice/ui/Markdown';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Typography/Markdown',
    component: Markdown,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Markdown renders trusted Markdown content with the Gredice typography styles used for editorial and help content.',
            },
        },
    },
    args: {
        children: [
            '## Harvest Notes',
            '',
            'Use Markdown when editorial content needs headings, links, and lists.',
            '',
            '- Keep copy concise.',
            '- Prefer descriptive link labels.',
            '- Render trusted content only.',
            '',
            '[Visit Gredice](https://www.gredice.com)',
        ].join('\n'),
        className: 'max-w-xl',
    },
} satisfies Meta<typeof Markdown>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
