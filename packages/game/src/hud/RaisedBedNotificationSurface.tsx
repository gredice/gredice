'use client';

import {
    operationCanceledNotificationType,
    operationCompletedNotificationType,
} from '@gredice/js/notifications';
import { ImageViewer } from '@gredice/ui/ImageViewer';
import { Close } from '@gredice/ui/icons';
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
import type { CurrentGarden } from '../hooks/useCurrentGarden';
import { useDismissRaisedBedNotification } from '../hooks/useDismissRaisedBedNotification';
import { useRaisedBedGardenNotifications } from '../hooks/useRaisedBedGardenNotifications';
import {
    type RaisedBedGardenNotification,
    raisedBedNotificationDisplayContent,
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

export type RaisedBedNotificationViewerImage = {
    alt: string;
    src: string;
};

function notificationMediaUrls(notification: RaisedBedGardenNotification) {
    return [notification.imageUrl, notification.iconUrl].flatMap((url) => {
        const normalizedUrl = url?.trim();
        return normalizedUrl ? [normalizedUrl] : [];
    });
}

export function RaisedBedNotificationBubbleContent({
    notification,
    onDismiss,
    onOpen,
    onOpenImage,
}: {
    notification: SelectedRaisedBedGardenNotification;
    onDismiss: (notification: SelectedRaisedBedGardenNotification) => void;
    onOpen: (notification: SelectedRaisedBedGardenNotification) => void;
    onOpenImage: (
        notification: SelectedRaisedBedGardenNotification,
        imageUrl: string,
    ) => void;
}) {
    const [failedMediaUrls, setFailedMediaUrls] = useState<string[]>([]);
    const mediaUrl = notificationMediaUrls(notification).find(
        (url) => !failedMediaUrls.includes(url),
    );
    const showMedia = Boolean(mediaUrl);
    const actionLabel = `Otvori obavijest za gredicu: ${notification.header}`;
    const dismissLabel = `Odbaci obavijest: ${notification.header}`;
    const notificationImageUrl = notification.imageUrl?.trim();
    const opensImageViewer =
        Boolean(mediaUrl) && mediaUrl === notificationImageUrl;
    const content = raisedBedNotificationDisplayContent(notification.content);
    const showContent = content && content !== notification.header.trim();

    function stopPointerEvent(event: PointerEvent<HTMLButtonElement>) {
        event.stopPropagation();
    }

    function handleOpen(event: MouseEvent<HTMLButtonElement>) {
        event.stopPropagation();
        if (mediaUrl && opensImageViewer) {
            onOpenImage(notification, mediaUrl);
        } else {
            onOpen(notification);
        }
    }

    function handleDismiss(event: MouseEvent<HTMLButtonElement>) {
        event.stopPropagation();
        onDismiss(notification);
    }

    return (
        <div
            aria-live="polite"
            className={cx(
                'group relative block overflow-visible rounded-xl border border-emerald-200 bg-white/95 p-0 text-sm leading-snug text-emerald-950 shadow-xl backdrop-blur-sm transition-transform hover:scale-105 dark:border-emerald-800/80 dark:bg-neutral-950/95 dark:text-emerald-50',
                showMedia ? 'h-20 w-28' : 'w-60 max-w-[80vw]',
            )}
            data-raised-bed-notification-bubble
            data-notification-id={notification.id}
            data-notification-kind={notification.kind}
        >
            <button
                type="button"
                aria-label={actionLabel}
                className={cx(
                    'block size-full touch-manipulation overflow-hidden rounded-[calc(0.75rem-1px)] p-0 text-inherit focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2',
                    showMedia ? 'text-center' : 'text-left',
                )}
                onClick={handleOpen}
                onPointerDown={stopPointerEvent}
                onPointerUp={stopPointerEvent}
            >
                {showMedia ? (
                    <span className="block size-full overflow-hidden">
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
                    <span className="block px-3 py-2.5 pr-9">
                        <span className="line-clamp-2 break-words font-semibold">
                            {notification.header}
                        </span>
                        {showContent ? (
                            <span className="mt-1 line-clamp-3 break-words text-xs font-normal text-emerald-900/80 dark:text-emerald-100/80">
                                {content}
                            </span>
                        ) : null}
                    </span>
                )}
            </button>
            <button
                type="button"
                aria-label={dismissLabel}
                title="Odbaci"
                className={cx(
                    'absolute right-1 top-1 z-10 inline-flex size-6 touch-manipulation items-center justify-center rounded-full border-0 p-0 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1',
                    showMedia
                        ? 'bg-black/65 text-white hover:bg-black/80'
                        : 'bg-white/80 text-emerald-950 hover:bg-emerald-50 dark:bg-neutral-950/80 dark:text-emerald-50 dark:hover:bg-neutral-900',
                )}
                data-raised-bed-notification-dismiss
                onClick={handleDismiss}
                onPointerDown={stopPointerEvent}
                onPointerUp={stopPointerEvent}
            >
                <Close className="size-3.5" />
            </button>
            <svg
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-full h-2.5 w-5 -translate-x-1/2 overflow-visible"
                data-raised-bed-notification-arrow
                viewBox="0 0 20 10"
            >
                <path
                    className="fill-white/95 stroke-emerald-200 dark:fill-neutral-950/95 dark:stroke-emerald-800/80"
                    d="M1 0.5h18L10 9.5Z"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    );
}

export function RaisedBedNotificationImageViewer({
    image,
    onClose,
}: {
    image: RaisedBedNotificationViewerImage | null;
    onClose: () => void;
}) {
    return image ? (
        <ImageViewer
            alt={image.alt}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            open
            showPreview={false}
            src={image.src}
        />
    ) : null;
}

export function useRaisedBedNotificationSurface(
    garden: RaisedBedNotificationSurfaceGarden | null | undefined,
) {
    const router = useRouter();
    const { track } = useGameAnalytics();
    const notificationSurfaceUnavailable = useGameState(
        (state) => state.isMock || state.localSandboxStorageKey !== null,
    );
    const notificationSurfaceEnabled = !notificationSurfaceUnavailable;
    const notificationsQuery = useRaisedBedGardenNotifications(
        notificationSurfaceEnabled ? garden?.id : undefined,
    );
    const dismissRaisedBedNotification = useDismissRaisedBedNotification();
    const [viewerImage, setViewerImage] =
        useState<RaisedBedNotificationViewerImage | null>(null);
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
            const isOperation =
                notification.type === operationCompletedNotificationType ||
                notification.type === operationCanceledNotificationType;
            const href = resolveRaisedBedNotificationHref({
                currentOrigin: window.location.origin,
                fieldTab: isOperation ? 'diary' : undefined,
                linkUrl: notification.linkUrl,
                raisedBedName: raisedBed?.name,
            });
            if (!href || !garden) {
                return;
            }

            try {
                await dismissRaisedBedNotification.mutateAsync({
                    gardenId: garden.id,
                    notificationId: notification.id,
                    scope: 'selected',
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
        [dismissRaisedBedNotification, garden, router, track],
    );

    const openImageNotification = useCallback(
        (
            notification: SelectedRaisedBedGardenNotification,
            imageUrl: string,
        ) => {
            if (!garden) return;

            setViewerImage({ alt: notification.header, src: imageUrl });
            track('game_raised_bed_notification_opened', {
                has_link: false,
                notification_id: notification.id,
                notification_kind: notification.kind,
                raised_bed_id: notification.raisedBedId,
            });
            void dismissRaisedBedNotification
                .mutateAsync({
                    gardenId: garden.id,
                    notificationId: notification.id,
                    scope: 'raised_bed_images',
                })
                .catch(() => undefined);
        },
        [dismissRaisedBedNotification, garden, track],
    );

    const dismissNotification = useCallback(
        (notification: SelectedRaisedBedGardenNotification) => {
            if (!garden) return;

            track('game_raised_bed_notification_dismissed', {
                notification_id: notification.id,
                notification_kind: notification.kind,
                raised_bed_id: notification.raisedBedId,
            });
            void dismissRaisedBedNotification
                .mutateAsync({
                    gardenId: garden.id,
                    notificationId: notification.id,
                    scope: 'selected',
                })
                .catch(() => undefined);
        },
        [dismissRaisedBedNotification, garden, track],
    );

    return {
        closeImageViewer: () => setViewerImage(null),
        dismissNotification,
        notifications: selectedNotifications,
        openImageNotification,
        openNotification,
        viewerImage,
    };
}
