'use client';

import { ImageGallery } from '@gredice/ui/ImageGallery';
import { Warning } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';

const BLOCKER_THUMBNAIL_SIZE = 44;

type ScheduleTaskBlockedDetailsProps = {
    blockedAt?: Date | string | null;
    imageUrls?: string[] | null;
    note?: string | null;
    reason?: string | null;
    taskKey: string;
};

function formatBlockedAt(value?: Date | string | null) {
    if (!value) {
        return null;
    }

    const date = typeof value === 'string' ? new Date(value) : value;
    if (!Number.isFinite(date.getTime())) {
        return null;
    }

    return {
        dateTime: date.toISOString(),
        label: new Intl.DateTimeFormat('hr-HR', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Europe/Zagreb',
        }).format(date),
    };
}

export function ScheduleTaskBlockedDetails({
    blockedAt,
    imageUrls,
    note,
    reason,
    taskKey,
}: ScheduleTaskBlockedDetailsProps) {
    const timestamp = formatBlockedAt(blockedAt);
    const normalizedImages = (imageUrls ?? [])
        .filter((url) => url.trim().length > 0)
        .map((url, index) => ({
            alt: `Fotografija prijavljene prepreke ${index + 1}`,
            src: url,
        }));
    const trimmedNote = note?.trim();

    return (
        <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <Stack spacing={2}>
                <div className="flex min-w-0 items-start gap-2">
                    <Warning aria-hidden className="mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0">
                        <Typography level="body2" semiBold>
                            Prijavljeno administratorima
                        </Typography>
                        <Typography
                            className="[overflow-wrap:anywhere]"
                            level="body2"
                        >
                            {reason?.trim() ||
                                'Zadatak nije bilo moguće dovršiti.'}
                        </Typography>
                        {timestamp ? (
                            <Typography level="body3">
                                <time dateTime={timestamp.dateTime}>
                                    {timestamp.label}
                                </time>
                            </Typography>
                        ) : null}
                    </div>
                </div>
                {trimmedNote ? (
                    <Typography
                        className="whitespace-pre-wrap [overflow-wrap:anywhere]"
                        level="body2"
                    >
                        <span className="font-semibold">Napomena:</span>{' '}
                        {trimmedNote}
                    </Typography>
                ) : null}
                {normalizedImages.length > 0 ? (
                    <div className="h-11 w-11 overflow-visible">
                        <ImageGallery
                            images={normalizedImages}
                            previewHeight={BLOCKER_THUMBNAIL_SIZE}
                            previewVariant="stacked"
                            previewWidth={BLOCKER_THUMBNAIL_SIZE}
                        />
                    </div>
                ) : null}
                <span className="sr-only">Blokirani zadatak {taskKey}</span>
            </Stack>
        </div>
    );
}
