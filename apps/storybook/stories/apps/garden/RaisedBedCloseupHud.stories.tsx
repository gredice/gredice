import { RaisedBedCloseupHudStory } from '@apps/garden/tests/RaisedBedFieldHudStory';
import {
    buildCartItem,
    type RaisedBedScenario,
    testSorts,
} from '@apps/garden/tests/raisedBedFieldHudScenarios';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const closeupScenario: RaisedBedScenario = {
    raisedBedBlockCount: 2,
    raisedBedOrientation: 'horizontal',
    fields: [
        {
            positionIndex: 0,
            plantSortId: testSorts.tomato.id,
            plantStatus: 'sprouted',
            plantSowDate: '2026-04-12T00:00:00.000Z',
            plantGrowthDate: '2026-04-28T00:00:00.000Z',
        },
        {
            positionIndex: 2,
            plantSortId: testSorts.basil.id,
            plantStatus: 'sowed',
            plantScheduledDate: '2026-05-18T00:00:00.000Z',
            plantSowDate: '2026-05-02T00:00:00.000Z',
        },
        {
            positionIndex: 4,
            plantSortId: testSorts.lettuce.id,
            plantStatus: 'ready',
            plantSowDate: '2026-03-29T00:00:00.000Z',
            plantGrowthDate: '2026-04-12T00:00:00.000Z',
            plantReadyDate: '2026-05-08T00:00:00.000Z',
        },
        {
            positionIndex: 9,
            plantSortId: testSorts.tomato.id,
            plantStatus: 'planned',
            plantScheduledDate: '2026-05-22T00:00:00.000Z',
        },
        {
            positionIndex: 13,
            plantSortId: testSorts.basil.id,
            plantStatus: 'sprouted',
            plantSowDate: '2026-04-18T00:00:00.000Z',
            plantGrowthDate: '2026-05-05T00:00:00.000Z',
        },
        {
            positionIndex: 16,
            plantSortId: testSorts.lettuce.id,
            plantStatus: 'sowed',
            plantSowDate: '2026-05-01T00:00:00.000Z',
        },
    ],
    cartItems: [
        buildCartItem({
            id: 1,
            positionIndex: 7,
            scheduledDate: '2026-05-24T00:00:00.000Z',
            sort: testSorts.lettuce,
        }),
        buildCartItem({
            id: 2,
            positionIndex: 11,
            sort: testSorts.basil,
        }),
    ],
};

function CloseupFrame({ height, width }: { height: number; width: number }) {
    return (
        <div className="flex min-h-screen items-start justify-center bg-[#213614] p-4">
            <RaisedBedCloseupHudStory
                height={height}
                scenario={closeupScenario}
                width={width}
            />
        </div>
    );
}

const meta = {
    title: 'apps/garden/Game/RaisedBedCloseupHud',
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Raised-bed closeup HUD examples for checking compact mobile sizing and side controls.',
            },
        },
    },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const ExtraSmallPhone: Story = {
    render: () => <CloseupFrame height={640} width={320} />,
};

export const SmallPhone: Story = {
    render: () => <CloseupFrame height={760} width={390} />,
};

export const RoomyPhone: Story = {
    render: () => <CloseupFrame height={812} width={414} />,
};
