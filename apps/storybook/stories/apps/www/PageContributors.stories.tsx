import { PageContributors } from '@apps/www/components/community-edits/PageContributors';
import { currentUserQueryKey } from '@apps/www/hooks/useCurrentUser';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { storyContributors } from './communityContributorsStoryData';

const queryClient = new QueryClient({
    defaultOptions: { queries: { enabled: false } },
});
queryClient.setQueryData(currentUserQueryKey, null);

const meta = {
    title: 'apps/www/Community/PageContributors',
    component: PageContributors,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Closing panel of a plant, sort, operation, block, disease or pest page. It names the latest editors, counts the rest, shows when the page last changed and offers a whole-page suggestion. Without contributors it invites the first one.',
            },
        },
    },
    decorators: [
        (Story) => (
            <QueryClientProvider client={queryClient}>
                <div className="max-w-3xl">
                    <Story />
                </div>
            </QueryClientProvider>
        ),
    ],
    args: {
        contributors: {
            contributors: storyContributors,
            lastEditedAt: storyContributors[0]?.lastEditedAt ?? null,
        },
        edit: {
            entityTypeName: 'plant',
            entityId: 7,
            publicPath: '/biljke/rajcica',
            entityName: 'Rajčica',
        },
    },
} satisfies Meta<typeof PageContributors>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const TwoEditors: Story = {
    args: {
        contributors: {
            contributors: storyContributors.slice(0, 2),
            lastEditedAt: storyContributors[0]?.lastEditedAt ?? null,
        },
    },
};
export const SingleEditor: Story = {
    args: {
        contributors: {
            contributors: storyContributors.slice(0, 1),
            lastEditedAt: storyContributors[0]?.lastEditedAt ?? null,
        },
    },
};
export const NoContributorsYet: Story = {
    args: { contributors: { contributors: [], lastEditedAt: null } },
};
export const Phone: Story = {
    decorators: [
        (Story) => (
            <div className="w-[328px]">
                <Story />
            </div>
        ),
    ],
};
export const Dark: Story = {
    decorators: [
        (Story) => (
            <div className="dark bg-background p-4 text-foreground">
                <Story />
            </div>
        ),
    ],
};
