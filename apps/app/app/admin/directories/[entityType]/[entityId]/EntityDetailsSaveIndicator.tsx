'use client';

import { Check, LoaderSpinner } from '@signalco/ui-icons';
import { Chip } from '@signalco/ui-primitives/Chip';
import { useEffect, useState } from 'react';
import { useEntityDetailsSave } from './EntityDetailsSaveContext';

const SAVED_STATE_DURATION_MS = 2000;

export function EntityDetailsSaveIndicator() {
    const { pendingSaveCount, lastSavedAt } = useEntityDetailsSave();
    const [showSaved, setShowSaved] = useState(false);
    const isSaving = pendingSaveCount > 0;

    useEffect(() => {
        if (isSaving) {
            setShowSaved(false);
            return;
        }

        if (!lastSavedAt) {
            return;
        }

        setShowSaved(true);
        const timeout = window.setTimeout(() => {
            setShowSaved(false);
        }, SAVED_STATE_DURATION_MS);

        return () => {
            window.clearTimeout(timeout);
        };
    }, [isSaving, lastSavedAt]);

    if (!isSaving && !showSaved) {
        return null;
    }

    return (
        <Chip color={isSaving ? 'info' : 'success'}>
            <span className="flex items-center gap-1 text-xs">
                {isSaving ? (
                    <LoaderSpinner className="size-3 animate-spin" />
                ) : (
                    <Check className="size-3" />
                )}
                {isSaving ? 'Spremanje…' : 'Spremljeno'}
            </span>
        </Chip>
    );
}
