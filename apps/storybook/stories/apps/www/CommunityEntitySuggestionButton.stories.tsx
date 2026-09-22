import { CommunityEntitySuggestionButton } from '@apps/www/components/community-edits/CommunityEntitySuggestionButton';
import { currentUserQueryKey } from '@apps/www/hooks/useCurrentUser';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
queryClient.setQueryData(currentUserQueryKey, null);

const meta = {
    title: 'apps/www/Plants/CommunityEntitySuggestionButton',
    component: CommunityEntitySuggestionButton,
    tags: ['autodocs'],
    decorators: [
        (Story) => (
            <QueryClientProvider client={queryClient}>
                <div className="w-80 max-w-full">
                    <Story />
                </div>
            </QueryClientProvider>
        ),
    ],
} satisfies Meta<typeof CommunityEntitySuggestionButton>;

export default meta;
type Story = StoryObj;

export const Tip: Story = {
    render: () => (
        <CommunityEntitySuggestionButton
            kind="plantTip"
            parentPlantId={7}
            parentPlantName="Bob"
            publicPath="/biljke/bob"
            compact
        />
    ),
};

export const Disease: Story = {
    render: () => (
        <CommunityEntitySuggestionButton
            kind="disease"
            plants={[{ value: '7', label: 'Bob' }]}
            defaultAffectedPlantId={7}
            publicPath="/biljke/bob"
            compact
        />
    ),
};

export const Pest: Story = {
    render: () => (
        <CommunityEntitySuggestionButton
            kind="pest"
            plants={[{ value: '7', label: 'Bob' }]}
            defaultAffectedPlantId={7}
            publicPath="/biljke/bob"
            compact
        />
    ),
};

export const StandardButton: Story = {
    render: () => (
        <CommunityEntitySuggestionButton
            kind="plantSort"
            parentPlantId={7}
            parentPlantName="Bob"
            publicPath="/biljke/bob"
        />
    ),
};

const authenticatedClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
authenticatedClient.setQueryData(currentUserQueryKey, {
    id: 'storybook-user',
    userName: 'ana',
    displayName: 'Ana',
    role: 'user',
});
authenticatedClient.setQueryData(
    ['community-plant-health-options', 'disease'],
    [
        {
            id: 21,
            information: {
                name: 'Pepelnica',
                shortDescription: 'Bijela prevlaka na listovima.',
            },
            relationships: { affectedPlants: [] },
        },
    ],
);
authenticatedClient.setQueryData(
    ['community-plant-health-options', 'pest'],
    [],
);

export const ExistingDisease: Story = {
    ...Disease,
    decorators: [
        (Story) => (
            <QueryClientProvider client={authenticatedClient}>
                <Story />
            </QueryClientProvider>
        ),
    ],
};

export const NoExistingPests: Story = {
    ...Pest,
    decorators: [
        (Story) => (
            <QueryClientProvider client={authenticatedClient}>
                <Story />
            </QueryClientProvider>
        ),
    ],
};
