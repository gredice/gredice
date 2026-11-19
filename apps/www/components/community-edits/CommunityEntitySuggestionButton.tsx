'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import type { CommunityEntitySuggestionButtonProps } from './CommunityEntitySuggestionButton.types';
import { CommunitySuggestionCard } from './CommunitySuggestionCard';
import {
    consumeSuggestionReturn,
    suggestionContextKey,
    suggestionLabels,
} from './communitySuggestionContext';
import { useCommunityDialogTrigger } from './useCommunityDialogTrigger';

export type {
    CommunityEntitySuggestionButtonProps,
    CommunityOperationSuggestionStage,
    CommunitySuggestionPlantOption,
} from './CommunityEntitySuggestionButton.types';

const CommunityEntitySuggestionDialog = dynamic(() =>
    import('./CommunityEntitySuggestionDialog').then(
        (module) => module.CommunityEntitySuggestionDialog,
    ),
);

/**
 * Dashed "something is missing" card that opens the suggestion form for a new
 * sort, tip, operation, disease or pest. The form loads on first use.
 */
export function CommunityEntitySuggestionButton(
    props: CommunityEntitySuggestionButtonProps,
) {
    const { handleTriggerClick, hasOpened, open, openDialog, setOpen } =
        useCommunityDialogTrigger();
    const contextKey = suggestionContextKey(props);
    const labels = suggestionLabels(props.kind);

    useEffect(() => {
        if (consumeSuggestionReturn(contextKey)) {
            openDialog();
        }
    }, [contextKey, openDialog]);

    return (
        <>
            <CommunitySuggestionCard
                aria-expanded={open}
                aria-haspopup="dialog"
                className={props.className}
                helper={labels.cardHelper}
                onClick={handleTriggerClick}
                srContext={props.triggerContext}
                title={labels.cardTitle}
            />
            {hasOpened ? (
                <CommunityEntitySuggestionDialog
                    {...props}
                    onOpenChange={setOpen}
                    open={open}
                />
            ) : null}
        </>
    );
}
