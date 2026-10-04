import { Card } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { Timeline, TimelineEntry, TimelineGroup } from '@gredice/ui/Timeline';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const timelineGroups = [
    {
        id: '2026-06',
        label: 'lipanj 2026.',
        entries: [
            {
                id: 'delivery-windows',
                date: '12. lipnja 2026.',
                title: 'Precizniji termini dostave',
                body: 'Korisnici vide jasniji status dostave i sljedeci korak nakon pripreme.',
            },
            {
                id: 'trace-labels',
                date: '5. lipnja 2026.',
                title: 'QR trag berbe',
                body: 'Svaka naljepnica moze voditi na javni trag berbe s radnjama i fotografijama.',
            },
        ],
    },
    {
        id: '2026-05',
        label: 'svibanj 2026.',
        entries: [
            {
                id: 'garden-activity',
                date: '24. svibnja 2026.',
                title: 'Pregled aktivnosti vrta',
                body: 'Tjedni pregled grupira radnje, fotografije i status biljaka u citljiv vremenski tijek.',
            },
        ],
    },
];

const meta = {
    title: 'packages/ui/Timeline',
    component: Timeline,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Timeline renders a responsive connected rail with grouped markers, date chips, and alternating desktop entries.',
            },
        },
    },
} satisfies Meta<typeof Timeline>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ReleaseTimeline: Story = {
    render: () => {
        let entryIndex = 0;
        const totalEntries = timelineGroups.reduce(
            (total, group) => total + group.entries.length,
            0,
        );

        return (
            <div className="max-w-5xl rounded-lg bg-background p-6">
                <Timeline>
                    {timelineGroups.map((group, groupIndex) => (
                        <TimelineGroup
                            isFirst={groupIndex === 0}
                            key={group.id}
                            label={group.label}
                        >
                            {group.entries.map((entry) => {
                                const currentEntryIndex = entryIndex;
                                entryIndex += 1;

                                return (
                                    <TimelineEntry
                                        index={currentEntryIndex}
                                        isLast={
                                            currentEntryIndex ===
                                            totalEntries - 1
                                        }
                                        key={entry.id}
                                        label={entry.date}
                                    >
                                        <Card className="p-5">
                                            <Stack spacing={2}>
                                                <Typography
                                                    level="h3"
                                                    className="text-xl"
                                                >
                                                    {entry.title}
                                                </Typography>
                                                <Typography className="text-muted-foreground">
                                                    {entry.body}
                                                </Typography>
                                            </Stack>
                                        </Card>
                                    </TimelineEntry>
                                );
                            })}
                        </TimelineGroup>
                    ))}
                </Timeline>
            </div>
        );
    },
};

export const LongContent: Story = {
    render: () => (
        <div className="max-w-5xl rounded-lg bg-background p-6">
            <Timeline>
                <TimelineGroup isFirst label="srpanj 2026.">
                    <TimelineEntry
                        index={0}
                        isLast={false}
                        label="1. srpnja 2026."
                    >
                        <Card className="p-5">
                            <Stack spacing={2}>
                                <Typography level="h3" className="text-xl">
                                    Dugi naslov koji se mora prelomiti bez
                                    pomicanja vremenske crte
                                </Typography>
                                <Typography className="text-muted-foreground">
                                    Ovaj primjer pokriva vise redaka teksta,
                                    dulji opis i stabilne razmake na mobilnom i
                                    desktop prikazu.
                                </Typography>
                            </Stack>
                        </Card>
                    </TimelineEntry>
                    <TimelineEntry index={1} isLast label="Bez datuma">
                        <Card className="p-5">
                            <Typography className="text-muted-foreground">
                                Zapisi bez datuma ostaju povezani s istom osi i
                                ne lome raspored.
                            </Typography>
                        </Card>
                    </TimelineEntry>
                </TimelineGroup>
            </Timeline>
        </div>
    ),
};
