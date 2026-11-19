import { SectionContributionBar } from '@apps/www/components/community-edits/SectionContributionBar';
import { currentUserQueryKey } from '@apps/www/hooks/useCurrentUser';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { storyContributors } from './communityContributorsStoryData';

const queryClient = new QueryClient({
    defaultOptions: { queries: { enabled: false } },
});
queryClient.setQueryData(currentUserQueryKey, null);

const edit = {
    entityTypeName: 'plant',
    entityId: 7,
    publicPath: '/biljke/rajcica',
    sectionKey: 'sowing',
    entityName: 'Rajčica',
    sectionLabel: 'Sijanje',
} as const;

const meta = {
    title: 'apps/www/Community/SectionContributionBar',
    component: SectionContributionBar,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'One labeled bar directly under a section of a directory page: rate the section ("Je li ovo korisno?"), suggest a change, and see who already improved it. It replaces the bare pencil and thumb icons. The bar wraps at phone widths and keeps its controls in place when nobody has contributed yet.',
            },
        },
    },
    decorators: [
        (Story) => (
            <QueryClientProvider client={queryClient}>
                <div className="max-w-xl">
                    <p className="mb-3 text-sm">
                        Sadržaj odjeljka stoji neposredno iznad trake.
                    </p>
                    <Story />
                </div>
            </QueryClientProvider>
        ),
    ],
    args: {
        feedback: {
            topic: 'www/plants/information',
            data: { plantId: 7, sectionId: 'sowing' },
        },
        edit,
        contributors: storyContributors.slice(0, 3),
    },
} satisfies Meta<typeof SectionContributionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const NoContributorsYet: Story = { args: { contributors: [] } };
export const ManyContributors: Story = {
    args: { contributors: storyContributors },
};
export const EditOnly: Story = { args: { feedback: undefined } };
export const RatingOnly: Story = { args: { edit: null, contributors: [] } };
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
