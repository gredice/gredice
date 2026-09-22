import { PlantHealthAffectedPlants } from '@apps/www/components/plant-health/PlantHealthAffectedPlants';
import { currentUserQueryKey } from '@apps/www/hooks/useCurrentUser';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
    defaultOptions: { queries: { enabled: false } },
});
queryClient.setQueryData(currentUserQueryKey, null);
const assetOrigin =
    typeof window === 'undefined' ? 'http://localhost' : window.location.origin;

const meta = {
    title: 'apps/www/Plants/PlantHealthAffectedPlants',
    component: PlantHealthAffectedPlants,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Affected-plant links use the public card surface and border. The trailing card-style CommunityEditButton opens the existing relationship suggestion flow for pests and diseases.',
            },
        },
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
    args: {
        entityId: 17,
        entityTypeName: 'plantPest',
        publicPath: '/stetnici/buhaci',
        plants: [
            {
                id: 1,
                slug: 'brokula',
                name: 'Brokula',
                latinName: 'Brassica oleracea var. italica',
                image: {
                    cover: {
                        url: `${assetOrigin}/assets/plants/broccoli_mature.png`,
                    },
                },
            },
            { id: 2, slug: 'kupus', name: 'Kupus' },
        ],
    },
} satisfies Meta<typeof PlantHealthAffectedPlants>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pest: Story = {};
export const Disease: Story = {
    args: { entityTypeName: 'plantDisease', publicPath: '/bolesti/pepelnica' },
};
export const Empty: Story = { args: { plants: [] } };
export const Dark: Story = {
    decorators: [
        (Story) => (
            <div className="dark bg-background text-foreground p-4">
                <Story />
            </div>
        ),
    ],
};
export const LongName: Story = {
    args: {
        plants: [
            {
                id: 3,
                slug: 'rotkvica',
                name: 'Rotkvica s vrlo dugim nazivom za provjeru prikaza',
                latinName: 'Raphanus sativus L. var. radicula DC.',
            },
        ],
    },
};
