import type { EntityStandardized } from '@gredice/storage';
import { PlantingSeedIcon } from '@gredice/ui/PlantingSeedIcon';
import Image from 'next/image';

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

function isHostedImageUrl(url: string | null | undefined): url is string {
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
        <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary/10 text-primary">
            {isHostedImageUrl(coverUrl) ? (
                <Image
                    src={coverUrl}
                    alt={label}
                    width={28}
                    height={28}
                    className="size-full object-cover"
                />
            ) : (
                <PlantingSeedIcon
                    aria-hidden="true"
                    className="size-4 shrink-0"
                />
            )}
        </span>
    );
}
