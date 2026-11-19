import { CommunityEditButton } from '@apps/www/components/community-edits/CommunityEditButton';
import { currentUserQueryKey } from '@apps/www/hooks/useCurrentUser';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
// Signed out: opening a trigger shows the sign-in dialog only.
queryClient.setQueryData(currentUserQueryKey, null);

const meta = {
    title: 'apps/www/Community/CommunityEditButton',
    component: CommunityEditButton,
    tags: ['autodocs'],
    args: {
        entityTypeName: 'plant',
        entityId: 7,
        entityName: 'Bob',
        publicPath: '/biljke/bob',
        sectionKey: 'sowing',
        sectionLabel: 'Sijanje',
    },
    decorators: [
        (Story) => (
            <QueryClientProvider client={queryClient}>
                <div className="w-80 max-w-full">
                    <Story />
                </div>
            </QueryClientProvider>
        ),
    ],
} satisfies Meta<typeof CommunityEditButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Icon: Story = { args: { buttonStyle: 'icon' } };

export const Outlined: Story = { args: { buttonStyle: 'button' } };

/** For bars that already have a border, such as the section contribution bar. */
export const Plain: Story = { args: { buttonStyle: 'plain' } };

export const Card: Story = {
    args: {
        buttonStyle: 'card',
        label: 'Predloži dobrog susjeda',
        sectionKey: 'relationships',
        sectionLabel: 'Biljni susjedi',
    },
};
