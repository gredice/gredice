'use client';

import {
    listGardenLikeIds,
    type SetGardenLikeInput,
    setGardenLike,
} from '@gredice/client';
import { Heart, LoaderSpinner } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type MouseEvent, useEffect, useMemo, useState } from 'react';
import { InlineLoginDialog } from '../../components/auth/InlineLoginDialog';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { formatGardenNumber } from './publicGardenFormatting';

const gardenLikeIdsQueryKey = ['publicGardenLikes'];

function applyGardenLikeIds(
    gardenIds: number[] | undefined,
    { gardenId, liked }: SetGardenLikeInput,
) {
    const currentIds = gardenIds ?? [];
    if (!liked) {
        return currentIds.filter(
            (currentGardenId) => currentGardenId !== gardenId,
        );
    }

    if (currentIds.includes(gardenId)) {
        return currentIds;
    }

    return [...currentIds, gardenId];
}

function likedSet(gardenIds: number[] | undefined) {
    return new Set(gardenIds ?? []);
}

function likeErrorMessage(error: unknown) {
    if (error instanceof Error && error.message === 'Cannot like own garden') {
        return 'Vlastiti vrt već ima tvoju ljubav.';
    }

    return 'Lajk nije spremljen. Pokušaj ponovno.';
}

export function PublicGardenLikeButton({
    className,
    gardenId,
    initialLikeCount,
}: {
    className?: string;
    gardenId: number;
    initialLikeCount: number;
}) {
    const queryClient = useQueryClient();
    const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser();
    const [loginOpen, setLoginOpen] = useState(false);
    const [likeCount, setLikeCount] = useState(initialLikeCount);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLikeCount(initialLikeCount);
    }, [initialLikeCount]);

    const likedGardensQuery = useQuery({
        queryKey: gardenLikeIdsQueryKey,
        queryFn: listGardenLikeIds,
        enabled: Boolean(currentUser),
        retry: false,
        staleTime: 1000 * 60 * 5,
    });
    const gardenIds = likedGardensQuery.data;
    const currentLikedGardenIds = useMemo(
        () => likedSet(gardenIds),
        [gardenIds],
    );
    const liked = Boolean(currentUser && currentLikedGardenIds.has(gardenId));

    async function updateLike(nextLiked: boolean) {
        setError(null);
        setIsUpdating(true);

        const previousGardenIds = queryClient.getQueryData<number[]>(
            gardenLikeIdsQueryKey,
        );
        const previousLikeCount = likeCount;
        const wasLiked = currentLikedGardenIds.has(gardenId);
        const optimisticDelta = nextLiked === wasLiked ? 0 : nextLiked ? 1 : -1;

        queryClient.setQueryData<number[]>(
            gardenLikeIdsQueryKey,
            applyGardenLikeIds(previousGardenIds, {
                gardenId,
                liked: nextLiked,
            }),
        );
        setLikeCount(Math.max(0, previousLikeCount + optimisticDelta));

        try {
            const result = await setGardenLike({
                gardenId,
                liked: nextLiked,
            });
            setLikeCount(result.likeCount);
            queryClient.setQueryData<number[]>(
                gardenLikeIdsQueryKey,
                applyGardenLikeIds(previousGardenIds, {
                    gardenId,
                    liked: result.liked,
                }),
            );
        } catch (updateError) {
            queryClient.setQueryData<number[]>(
                gardenLikeIdsQueryKey,
                previousGardenIds,
            );
            setLikeCount(previousLikeCount);
            setError(likeErrorMessage(updateError));
        } finally {
            setIsUpdating(false);
            void queryClient.invalidateQueries({
                queryKey: gardenLikeIdsQueryKey,
            });
        }
    }

    function handleClick(event: MouseEvent<HTMLButtonElement>) {
        event.preventDefault();
        event.stopPropagation();

        if (isLoadingUser || isUpdating) {
            return;
        }

        if (!currentUser) {
            setLoginOpen(true);
            return;
        }

        void updateLike(!liked);
    }

    function handleAuthenticated() {
        void updateLike(true);
    }

    const actionLabel = liked
        ? 'Makni lajk s vrta'
        : currentUser
          ? 'Lajkaj vrt'
          : 'Prijavi se za lajk';

    return (
        <>
            <div className={cx('relative z-20 min-w-0', className)}>
                <button
                    aria-disabled={isLoadingUser || isUpdating}
                    aria-label={actionLabel}
                    className={cx(
                        'flex h-full w-full min-w-0 items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        !currentUser && 'text-muted-foreground',
                    )}
                    onClick={handleClick}
                    title={actionLabel}
                    type="button"
                >
                    {isUpdating ? (
                        <LoaderSpinner
                            aria-hidden
                            className="size-4 shrink-0 animate-spin text-primary"
                        />
                    ) : (
                        <Heart
                            aria-hidden
                            className={cx(
                                'size-4 shrink-0 text-primary',
                                liked && 'fill-primary',
                            )}
                        />
                    )}
                    <span className="min-w-0">
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Sviđa se
                        </Typography>
                        <Typography
                            level="body2"
                            className="truncate font-medium"
                        >
                            {formatGardenNumber(likeCount)}
                        </Typography>
                    </span>
                </button>
                {error ? (
                    <Typography
                        level="body3"
                        className="absolute left-3 right-3 top-full mt-1 rounded-sm bg-background/95 text-red-700 shadow-sm"
                    >
                        {error}
                    </Typography>
                ) : null}
            </div>
            <InlineLoginDialog
                description="Prijavi se ovdje i odmah ćemo spremiti lajk za ovaj vrt."
                onAuthenticated={handleAuthenticated}
                onOpenChange={setLoginOpen}
                open={loginOpen}
            />
        </>
    );
}
