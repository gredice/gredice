'use client';

import { useSyncExternalStore } from 'react';
import { IconButton } from '../IconButton';
import { Megaphone } from '../icons';
import { cx } from '../utils';
import {
    reviewSnapshot,
    serverReviewSnapshot,
    subscribeToReview,
    toggleReview,
} from './reviewStore';

/** Icon button that turns the UIer review toolbar on or off for this app. */
export function UierReviewButton({
    className,
    label = 'Povratne informacije',
}: {
    className?: string;
    label?: string;
}) {
    const state = useSyncExternalStore(
        subscribeToReview,
        reviewSnapshot,
        serverReviewSnapshot,
    );
    const enabled = state === 'enabled';

    return (
        <IconButton
            aria-label={label}
            title={label}
            aria-pressed={enabled}
            disabled={state === 'unavailable'}
            onClick={() => toggleReview(!enabled)}
            size="sm"
            className={cx(
                'shrink-0 rounded-md',
                enabled && 'bg-primary/10 text-primary',
                className,
            )}
        >
            <Megaphone className="size-5" />
        </IconButton>
    );
}
