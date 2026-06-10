import { HarvestTraceStatusEvent } from '@apps/www/app/trag/[token]/HarvestTraceStatusEvent';
import { plantFieldStatusLabel } from '@gredice/js/plants';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const statusOrder = [
    'pendingVerification',
    'sowed',
    'sprouted',
    'firstFlowers',
    'firstFruitSet',
    'ready',
    'harvested',
    'removed',
    'notSprouted',
    'died',
];

function buildStatusItem(status: string, index: number) {
    const label = plantFieldStatusLabel(status);

    return {
        description: label.description,
        location: {
            fieldLabel: `${index + 1}`,
            raisedBedName: 'Gredica rajcice',
            raisedBedPhysicalId: '12B',
        },
        plantStatus: status,
        title: label.shortLabel,
    };
}

const meta = {
    title: 'apps/www/Trace/HarvestTraceStatus',
    component: HarvestTraceStatusEvent,
    tags: ['autodocs'],
    args: {
        item: buildStatusItem('sprouted', 2),
    },
    parameters: {
        docs: {
            description: {
                component:
                    'Plant lifecycle rows used by the public harvest trace timeline.',
            },
        },
        layout: 'fullscreen',
    },
} satisfies Meta<typeof HarvestTraceStatusEvent>;

export default meta;

type Story = StoryObj<typeof meta>;

const statusItems = statusOrder.map(buildStatusItem);

export const Default: Story = {};

export const DarkModeAllStatuses: Story = {
    render: () => (
        <div className="dark">
            <div className="min-h-screen bg-background p-4 text-foreground sm:p-8">
                <div className="mx-auto max-w-2xl rounded-lg bg-card p-4 shadow-sm ring-1 ring-border/80 sm:p-5">
                    <Stack spacing={4}>
                        <Stack spacing={1}>
                            <Typography level="h2" className="text-2xl">
                                Status biljke
                            </Typography>
                            <Typography className="text-muted-foreground">
                                Javni trag berbe
                            </Typography>
                        </Stack>
                        <div className="space-y-2">
                            {statusItems.map((item) => (
                                <HarvestTraceStatusEvent
                                    key={item.plantStatus}
                                    item={item}
                                />
                            ))}
                        </div>
                    </Stack>
                </div>
            </div>
        </div>
    ),
};
