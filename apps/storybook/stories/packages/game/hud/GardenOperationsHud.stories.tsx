import {
    GardenOperationsHudStory,
    OpenGardenOperationsHudStory,
} from '@apps/garden/tests/GardenOperationsHudStory';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/game/HUD/GardenOperationsHud',
    component: OpenGardenOperationsHudStory,
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'The in-game operations HUD with mocked garden data. The popover lists cart operations, then the upcoming operations and plantings grouped by day; "Prikaži sve radnje" opens the full history with the same day grouping.',
            },
        },
    },
    args: {
        denseOperations: false,
    },
} satisfies Meta<typeof OpenGardenOperationsHudStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const UpcomingOperations: Story = {
    parameters: {
        docs: {
            description: {
                story: 'The open popover: cart operations first, then upcoming work grouped by day. Every day starts expanded because this list is short and actionable.',
            },
        },
    },
};

export const DenseUpcomingOperations: Story = {
    args: {
        denseOperations: true,
    },
    parameters: {
        docs: {
            description: {
                story: 'A busier garden, showing how the day headers and bubbles behave once several days carry work.',
            },
        },
    },
};

export const Closed: Story = {
    render: () => <GardenOperationsHudStory />,
    parameters: {
        docs: {
            description: {
                story: 'The HUD button as it sits in the game, before the popover is opened.',
            },
        },
    },
};
