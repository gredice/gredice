import type { PlantSortData } from '@gredice/client';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { cx } from '@gredice/ui/utils';

export function GreenhouseSeedlingPlantVisual({
    className,
    imageSize,
    plantSort,
}: {
    className?: string;
    imageSize: number;
    plantSort: PlantSortData;
}) {
    return (
        <span
            className={cx(
                'relative inline-flex items-center justify-center rounded-full',
                className,
            )}
            data-greenhouse-seedling-visual
        >
            <span
                className="absolute inset-0 rounded-full border border-emerald-500/70 bg-emerald-50/70 dark:bg-emerald-950/50"
                aria-hidden="true"
            />
            <PlantOrSortImage
                plantSort={plantSort}
                className="relative z-10 rounded-full"
                width={imageSize}
                height={imageSize}
            />
        </span>
    );
}
