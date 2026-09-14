import { SelectedPlantingDiary } from '@packages/game/hud/raisedBed/SelectedPlantingDiary';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const entries = [
    {
        id: 1,
        name: 'Zatraženo sijanje biljke',
        description: '',
        status: null,
        timestamp: new Date('2026-09-01T08:00:00Z'),
        imageUrls: [],
    },
    {
        id: 2,
        name: 'Sijanje je potvrđeno',
        description: '',
        status: null,
        timestamp: new Date('2026-09-02T08:00:00Z'),
        imageUrls: [],
    },
    {
        id: -3,
        name: 'Okopavanje',
        description: '',
        status: 'Planirano',
        timestamp: new Date('2026-09-15T08:00:00Z'),
        imageUrls: [],
    },
];
const meta = {
    title: 'Game/Selected planting diary',
    component: SelectedPlantingDiary,
    args: { gardenId: 1, raisedBedId: 1, plantingId: 901 },
    decorators: [
        (Story, context) => {
            const client = new QueryClient({
                defaultOptions: {
                    queries: { retry: false, staleTime: Infinity },
                },
            });
            client.setQueryData(
                ['raisedBeds', 1, 'plantings', 901, 'diary'],
                context.parameters.empty ? [] : entries,
            );
            return (
                <QueryClientProvider client={client}>
                    <div className="max-w-lg p-4">
                        <Story />
                    </div>
                </QueryClientProvider>
            );
        },
    ],
} satisfies Meta<typeof SelectedPlantingDiary>;
export default meta;
type Story = StoryObj<typeof meta>;
export const LifecycleAndOperations: Story = {};
export const Empty: Story = { parameters: { empty: true } };
