import type { PlantData } from '@gredice/client';
import { Card } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';
import {
    PlantGrowthCalendar,
    type PlantGrowthCalendarWindows,
} from '../biljke/[alias]/PlantGrowthCalendar';
import { PlantYearCalendar } from '../biljke/[alias]/PlantYearCalendar';

const previewDate = new Date('2026-03-15T12:00:00.000Z');

const previewSowingCalendar = {
    sowing: [
        { start: 3, end: 4.5 },
        { start: 9, end: 9.75 },
    ],
    propagating: [{ start: 2, end: 3.5 }],
    planting: [{ start: 5, end: 6.5 }],
    harvest: [{ start: 7, end: 9.5 }],
} satisfies PlantData['calendar'];

const previewGrowthWindows = {
    germinationWindowMin: 7,
    germinationWindowMax: 14,
    growthWindowMin: 55,
    growthWindowMax: 85,
    harvestWindowMin: 20,
    harvestWindowMax: 40,
} satisfies PlantGrowthCalendarWindows;

function CalendarPreviewFrame({
    children,
    className,
    description,
    title,
}: {
    children: ReactNode;
    className?: string;
    description: string;
    title: string;
}) {
    return (
        <figure
            className={cx(
                'not-prose my-4 w-full sm:w-fit sm:min-w-[34rem] sm:max-w-full',
                className,
            )}
        >
            <Stack spacing={2}>
                <Stack spacing={1}>
                    <Typography level="body2" semiBold>
                        {title}
                    </Typography>
                    <Typography level="body3" className="text-muted-foreground">
                        {description}
                    </Typography>
                </Stack>
                <Card className="overflow-hidden bg-card">
                    <div className="rounded-md">{children}</div>
                </Card>
            </Stack>
        </figure>
    );
}

export function SowingCalendarPreview({ className }: { className?: string }) {
    return (
        <CalendarPreviewFrame
            className={className}
            title="Primjer kalendara sjetve"
            description="Oznake i boje prikazuju aktivnosti kroz mjesece: sijanje unutra, sijanje vani, presađivanje i berbu."
        >
            <PlantYearCalendar
                activities={previewSowingCalendar}
                now={previewDate}
            />
        </CalendarPreviewFrame>
    );
}

export function GrowthCalendarPreview({ className }: { className?: string }) {
    return (
        <CalendarPreviewFrame
            className={className}
            title="Primjer kalendara rasta"
            description="Oznake i boje prikazuju faze koje se računaju od današnje sjetve: klijanje, rast i berbu."
        >
            <PlantGrowthCalendar
                windows={previewGrowthWindows}
                now={previewDate}
            />
        </CalendarPreviewFrame>
    );
}
