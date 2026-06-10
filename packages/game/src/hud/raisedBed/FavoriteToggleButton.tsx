import type { FavoriteEntityType } from '@gredice/client';
import { IconButton } from '@gredice/ui/IconButton';
import { Bookmark } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import type { MouseEvent } from 'react';
import { useGameAnalytics } from '../../analytics/GameAnalyticsContext';
import { useFavoriteIds, useSetFavorite } from '../../hooks/useFavorites';

const favoriteEntityLabels: Record<FavoriteEntityType, string> = {
    plant: 'biljku',
    plantSort: 'sortu',
    operation: 'radnju',
};

function favoriteButtonTitle({
    entityType,
    isFavorite,
}: {
    entityType: FavoriteEntityType;
    isFavorite: boolean;
}) {
    const entityLabel = favoriteEntityLabels[entityType];
    return isFavorite
        ? `Ukloni ${entityLabel} iz omiljenih`
        : `Dodaj ${entityLabel} u omiljene`;
}

export function FavoriteToggleButton({
    className,
    entityId,
    entityType,
    label,
}: {
    className?: string;
    entityId: number;
    entityType: FavoriteEntityType;
    label: string;
}) {
    const { track } = useGameAnalytics();
    const favoriteIds = useFavoriteIds(entityType);
    const setFavorite = useSetFavorite();
    const isFavorite = favoriteIds.has(entityId);
    const nextFavoriteState = !isFavorite;

    function handleClick(event: MouseEvent<HTMLButtonElement>) {
        setFavorite.mutate(
            {
                entityType,
                entityId,
                favorited: nextFavoriteState,
            },
            {
                onSuccess: () => {
                    track(
                        nextFavoriteState
                            ? 'game_favorite_added'
                            : 'game_favorite_removed',
                        {
                            entity_id: entityId,
                            entity_label: label,
                            entity_type: entityType,
                        },
                    );
                },
            },
        );

        event.preventDefault();
        event.stopPropagation();
    }

    return (
        <IconButton
            aria-pressed={isFavorite}
            className={cx(
                'size-8 shrink-0',
                isFavorite && 'text-amber-600 dark:text-amber-300',
                className,
            )}
            color={isFavorite ? 'warning' : 'neutral'}
            data-favorite-entity-id={entityId}
            data-favorite-entity-type={entityType}
            disabled={setFavorite.isPending}
            onClick={handleClick}
            size="sm"
            title={favoriteButtonTitle({
                entityType,
                isFavorite,
            })}
            variant={isFavorite ? 'soft' : 'plain'}
        >
            <Bookmark
                aria-hidden
                className={cx('size-4', isFavorite && 'fill-current')}
            />
        </IconButton>
    );
}
