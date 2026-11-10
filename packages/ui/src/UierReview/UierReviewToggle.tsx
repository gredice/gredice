'use client';

import { useSyncExternalStore } from 'react';
import { Switch } from '../Switch';
import { cx } from '../utils';
import {
    reviewSnapshot,
    serverReviewSnapshot,
    subscribeToReview,
    toggleReview,
} from './reviewStore';

export function UierReviewToggle({
    checked,
    className,
    disabled,
    label = 'Povratne informacije',
    onCheckedChange,
}: {
    checked?: boolean;
    className?: string;
    disabled?: boolean;
    label?: string;
    onCheckedChange?: (checked: boolean) => void;
}) {
    const state = useSyncExternalStore(
        subscribeToReview,
        reviewSnapshot,
        serverReviewSnapshot,
    );

    return (
        <div className={cx('inline-flex items-center', className)}>
            <Switch
                checked={checked ?? state === 'enabled'}
                disabled={
                    disabled ??
                    (checked === undefined && state === 'unavailable')
                }
                label={label}
                onCheckedChange={onCheckedChange ?? toggleReview}
                size="sm"
            />
        </div>
    );
}
