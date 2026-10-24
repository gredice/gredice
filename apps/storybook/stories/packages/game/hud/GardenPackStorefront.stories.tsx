import { GardenPackOfferCard } from '@packages/game/hud/GardenPackOfferCard';
import { createGameState, GameStateContext } from '@packages/game/useGameState';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createGardenPackOfferFixture } from '../../../../../../packages/game/tests/gardenPackStorefrontFixture';

const offer = createGardenPackOfferFixture();
const queryClient = new QueryClient({
    defaultOptions: { queries: { enabled: false } },
});
const store = createGameState({
    appBaseUrl: 'https://vrt.gredice.com',
    freezeTime: null,
    isMock: true,
    winterMode: 'summer',
});
const meta = {
    title: 'packages/game/hud/GardenPackStorefront',
    component: GardenPackOfferCard,
    tags: ['autodocs'],
    args: { offer, blockData: [], onReview: () => {} },
    decorators: [
        (Story) => (
            <QueryClientProvider client={queryClient}>
                <GameStateContext.Provider value={store}>
                    <div className="max-w-sm bg-background p-4">
                        <Story />
                    </div>
                </GameStateContext.Provider>
            </QueryClientProvider>
        ),
    ],
} satisfies Meta<typeof GardenPackOfferCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ExactContents: Story = {};
export const Expired: Story = {
    args: {
        offer: { ...offer, available: false, unavailableReason: 'expired' },
    },
};
export const NoComparison: Story = {
    args: { offer: { ...offer, individualTotalSunflowers: null } },
};
export const NoReviewedArt: Story = {
    args: {
        offer: { ...offer, previews: ['https://example.test/unknown.png'] },
    },
};
export const PacketMoreExpensive: Story = {
    args: { offer: { ...offer, individualTotalSunflowers: 5 } },
};
