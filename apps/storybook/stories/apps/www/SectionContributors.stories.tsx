import { SectionContributors } from '@apps/www/components/community-edits/SectionContributors';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { storyContributors } from './communityContributorsStoryData';

const meta = {
    title: 'apps/www/Community/SectionContributors',
    component: SectionContributors,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Avatar stack of the gardeners whose accepted suggestions shaped a section, newest first. Hover previews a short list; click, Enter or Space pins it open with focus inside; Escape closes it. Each row links to the public profile. Renders nothing without contributors.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="flex min-h-72 items-end justify-end p-6">
                <Story />
            </div>
        ),
    ],
    args: { contributors: storyContributors.slice(0, 3) },
} satisfies Meta<typeof SectionContributors>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const SingleEditor: Story = {
    args: { contributors: storyContributors.slice(0, 1) },
};
export const MoreThanListed: Story = {
    args: { contributors: storyContributors },
};
export const PageLabel: Story = {
    args: { contributors: storyContributors, label: 'Urednici stranice' },
};
export const Empty: Story = { args: { contributors: [] } };
export const Dark: Story = {
    decorators: [
        (Story) => (
            <div className="dark bg-background p-4 text-foreground">
                <Story />
            </div>
        ),
    ],
};
