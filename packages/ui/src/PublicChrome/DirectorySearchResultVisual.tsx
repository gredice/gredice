import Image from 'next/image';
import type { ComponentType, SVGProps } from 'react';
import {
    GameBlocksIcon,
    GameJournalIcon,
    GameLeafIcon,
    GamePlantDiseaseIcon,
    GamePlantPestIcon,
    GameSeedlingIcon,
    GameSeedPacketIcon,
} from '../GameIcons';
import { OperationCategoryIcon } from '../OperationImage';
import { cx } from '../utils';

type DirectorySearchResult = {
    entityType: string;
    imageAlt?: string | null;
    imageUrl?: string | null;
    visualKey?: string | null;
};

type ResultFallbackIconProps = SVGProps<SVGSVGElement>;

const resultFallbackIcons: Record<
    string,
    ComponentType<ResultFallbackIconProps>
> = {
    plant: GameLeafIcon,
    plantSort: GameSeedlingIcon,
    plantDisease: GamePlantDiseaseIcon,
    plantPest: GamePlantPestIcon,
    block: GameBlocksIcon,
    seed: GameSeedPacketIcon,
};

function resultFallbackKey(result: DirectorySearchResult) {
    if (result.entityType === 'operation') {
        return result.visualKey ?? 'operation';
    }

    return result.entityType;
}

export function DirectorySearchResultVisual({
    result,
    className,
    iconClassName,
    imageSize = 40,
}: {
    result: DirectorySearchResult;
    className?: string;
    iconClassName?: string;
    imageSize?: number;
}) {
    const fallbackKey = resultFallbackKey(result);
    const Icon = resultFallbackIcons[result.entityType] ?? GameJournalIcon;

    return (
        <span
            className={cx(
                'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary/10 text-primary',
                className,
            )}
        >
            {result.imageUrl ? (
                <Image
                    src={result.imageUrl}
                    alt={result.imageAlt ?? ''}
                    width={imageSize}
                    height={imageSize}
                    className="size-full object-cover"
                />
            ) : (
                <span
                    aria-hidden="true"
                    className="flex size-full items-center justify-center"
                    data-search-result-icon={fallbackKey}
                >
                    {result.entityType === 'operation' ? (
                        <OperationCategoryIcon
                            aria-hidden
                            variant="game"
                            categoryName={result.visualKey}
                            className={cx('size-7 shrink-0', iconClassName)}
                        />
                    ) : (
                        <Icon
                            aria-hidden
                            className={cx('size-7 shrink-0', iconClassName)}
                        />
                    )}
                </span>
            )}
        </span>
    );
}
