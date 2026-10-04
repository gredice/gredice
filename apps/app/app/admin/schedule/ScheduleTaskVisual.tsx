'use client';

import { OperationImage } from '@gredice/ui/OperationImage';
import { PlantingSeedIcon } from '@gredice/ui/PlantingSeedIcon';
import { cx } from '@gredice/ui/utils';
import Image from 'next/image';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';

function getCoverUrl(entity: EntityStandardized | null | undefined) {
    return entity?.image?.cover?.url ?? entity?.images?.cover?.url ?? null;
}

function getPlantSortCoverUrl(
    plantSort: EntityStandardized | null | undefined,
) {
    return (
        getCoverUrl(plantSort) ??
        getCoverUrl(plantSort?.information?.plant) ??
        null
    );
}

function isHostedImageUrl(url: string | null | undefined) {
    return !!url && /^https?:\/\//u.test(url);
}

export function SchedulePlantVisual({
    plantSort,
    label,
}: {
    plantSort: EntityStandardized | null | undefined;
    label: string;
}) {
    const coverUrl = getPlantSortCoverUrl(plantSort);

    return (
        <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-primary/10 text-primary">
            {isHostedImageUrl(coverUrl) ? (
                <Image
                    src={coverUrl}
                    alt={label}
                    width={20}
                    height={20}
                    className="size-full object-cover"
                />
            ) : (
                <PlantingSeedIcon
                    aria-hidden="true"
                    className="size-3.5 shrink-0"
                />
            )}
        </span>
    );
}

export function ScheduleOperationVisual({
    operation,
    label,
}: {
    operation: EntityStandardized | null | undefined;
    label: string;
}) {
    return (
        <span
            className={cx(
                'flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted text-muted-foreground',
                getCoverUrl(operation) && 'bg-transparent',
            )}
        >
            <OperationImage
                operation={{
                    image: operation?.image ?? operation?.images,
                    information: { label },
                }}
                size={20}
                className="size-5"
            />
        </span>
    );
}
