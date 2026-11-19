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
    checked,
    className,
    disabled,
    onCheckedChange,
    label = 'Povratne informacije',
}: {
    checked?: boolean;
    className?: string;
    disabled?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    label?: string;
}) {
    const state = useSyncExternalStore(
        subscribeToReview,
        reviewSnapshot,
        serverReviewSnapshot,
    );
    const enabled = checked ?? state === 'enabled';

    return (
        <IconButton
            aria-label={label}
            title={label}
            aria-pressed={enabled}
            disabled={
                disabled ?? (checked === undefined && state === 'unavailable')
            }
            onClick={() => (onCheckedChange ?? toggleReview)(!enabled)}
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
