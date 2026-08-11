'use client';

import { cx } from '@gredice/ui/utils';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import {
    type MouseEvent,
    type PointerEvent,
    useCallback,
    useMemo,
    useState,
} from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { useGameFlags } from '../GameFlagsContext';
import type { CurrentGarden } from '../hooks/useCurrentGarden';
import { useRaisedBedGardenNotifications } from '../hooks/useRaisedBedGardenNotifications';
import { useSetNotificationRead } from '../hooks/useSetNotificationRead';
import {
    type RaisedBedGardenNotification,
    selectRaisedBedGardenNotifications,
} from '../raisedBedNotifications';
import { useGameState } from '../useGameState';
import {
    navigateNotificationLink,
    resolveRaisedBedNotificationHref,
} from './notificationNavigation';

export type RaisedBedNotificationSurfaceGarden = Pick<
    CurrentGarden,
    'id' | 'raisedBeds'
>;

export type SelectedRaisedBedGardenNotification = ReturnType<
    typeof selectRaisedBedGardenNotifications
>[number];

function notificationMediaUrls(notification: RaisedBedGardenNotification) {
    return [notification.imageUrl, notification.iconUrl].flatMap((url) => {
        const normalizedUrl = url?.trim();
        return normalizedUrl ? [normalizedUrl] : [];
    });
}

export function RaisedBedNotificationBubbleContent({
    notification,
    onOpen,
}: {
    notification: SelectedRaisedBedGardenNotification;
    onOpen: (notification: SelectedRaisedBedGardenNotification) => void;
}) {
    const [failedMediaUrls, setFailedMediaUrls] = useState<string[]>([]);
    const mediaUrl = notificationMediaUrls(notification).find(
        (url) => !failedMediaUrls.includes(url),
    );
    const showMedia = Boolean(mediaUrl);
    const actionLabel = `Otvori obavijest za gredicu: ${notification.header}`;

    function stopPointerEvent(event: PointerEvent<HTMLButtonElement>) {
        event.stopPropagation();
    }

    function handleOpen(event: MouseEvent<HTMLButtonElement>) {
        event.stopPropagation();
        onOpen(notification);
    }

    return (
        <button
            type="button"
            aria-label={actionLabel}
            aria-live="polite"
            className={cx(
                'group relative block touch-manipulation overflow-visible rounded-xl border border-emerald-200 bg-white/95 p-0 text-center text-sm font-semibold leading-snug text-emerald-950 shadow-xl backdrop-blur-sm transition-transform hover:scale-105 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:border-emerald-800/80 dark:bg-neutral-950/95 dark:text-emerald-50',
                showMedia ? 'h-20 w-28' : 'max-w-[min(15rem,75vw)]',
            )}
            data-raised-bed-notification-bubble
            data-notification-id={notification.id}
            data-notification-kind={notification.kind}
            onClick={handleOpen}
            onPointerDown={stopPointerEvent}
            onPointerUp={stopPointerEvent}
        >
            {showMedia ? (
                <span className="block size-full overflow-hidden rounded-[calc(0.75rem-1px)]">
                    {/** biome-ignore lint/performance/noImgElement: Notification media uses runtime URLs from the authenticated API. */}
                    <img
                        alt={notification.header}
                        className="size-full object-cover"
                        data-raised-bed-notification-image
                        draggable={false}
                        onError={() => {
                            if (mediaUrl) {
                                setFailedMediaUrls((current) =>
                                    current.includes(mediaUrl)
                                        ? current
                                        : [...current, mediaUrl],
                                );
                            }
                        }}
                        src={mediaUrl}
                    />
                </span>
            ) : (
                <span className="block px-3 py-2.5">{notification.header}</span>
            )}
            <span
                aria-hidden="true"
                className="absolute top-full left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-r border-b border-emerald-200 bg-white/95 dark:border-emerald-800/80 dark:bg-neutral-950/95"
            />
        </button>
    );
}

export function useRaisedBedNotificationSurface(
    garden: RaisedBedNotificationSurfaceGarden | null | undefined,
) {
    const router = useRouter();
    const { track } = useGameAnalytics();
    const { enableRaisedBedNotificationBubblesFlag = false } = useGameFlags();
    const notificationSurfaceUnavailable = useGameState(
        (state) => state.isMock || state.localSandboxStorageKey !== null,
    );
    const notificationSurfaceEnabled =
        enableRaisedBedNotificationBubblesFlag &&
        !notificationSurfaceUnavailable;
    const notificationsQuery = useRaisedBedGardenNotifications(
        notificationSurfaceEnabled ? garden?.id : undefined,
    );
    const setNotificationRead = useSetNotificationRead();
    const selectedNotifications = useMemo(
        () =>
            garden && notificationSurfaceEnabled
                ? selectRaisedBedGardenNotifications({
                      gardenId: garden.id,
                      notifications: notificationsQuery.data ?? [],
                      raisedBedIds: garden.raisedBeds.map(
                          (raisedBed) => raisedBed.id,
                      ),
                  })
                : [],
        [garden, notificationSurfaceEnabled, notificationsQuery.data],
    );

    const openNotification = useCallback(
        async (notification: SelectedRaisedBedGardenNotification) => {
            const raisedBed = garden?.raisedBeds.find(
                (candidate) => candidate.id === notification.raisedBedId,
            );
            const href = resolveRaisedBedNotificationHref({
                currentOrigin: window.location.origin,
                linkUrl: notification.linkUrl,
                raisedBedName: raisedBed?.name,
            });
            if (!href) {
                return;
            }

            try {
                await setNotificationRead.mutateAsync({
                    id: notification.id,
                    read: true,
                    readWhere: 'game_raised_bed_bubble',
                });
            } catch {
                return;
            }

            track('game_raised_bed_notification_opened', {
                has_link: true,
                notification_id: notification.id,
                notification_kind: notification.kind,
                raised_bed_id: notification.raisedBedId,
            });
            navigateNotificationLink({
                assign: (url) => window.location.assign(url),
                currentOrigin: window.location.origin,
                href,
                push: (url) => router.push(url as Route),
            });
        },
        [garden?.raisedBeds, router, setNotificationRead, track],
    );

    return {
        notifications: selectedNotifications,
        openNotification,
    };
}
