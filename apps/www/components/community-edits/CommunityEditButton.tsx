'use client';

import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Edit } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import dynamic from 'next/dynamic';
import { type ButtonHTMLAttributes, useEffect } from 'react';
import type { CommunityEditButtonProps } from './CommunityEditButton.types';
import { CommunitySuggestionCard } from './CommunitySuggestionCard';
import { currentCommunityEditReturnRequest } from './communityEditContext';
import { useCommunityDialogTrigger } from './useCommunityDialogTrigger';

export type { CommunityEditButtonProps } from './CommunityEditButton.types';

const CommunityEditDialog = dynamic(() =>
    import('./CommunityEditDialog').then(
        (module) => module.CommunityEditDialog,
    ),
);

export function CommunityEditButton({
    buttonStyle = 'icon',
    className,
    ...props
}: CommunityEditButtonProps) {
    const { handleTriggerClick, hasOpened, open, openDialog, setOpen } =
        useCommunityDialogTrigger();
    const { entityTypeName, entityId, fieldKey, sectionKey, label } = props;
    const triggerLabel = label ?? 'Predloži izmjenu';

    useEffect(() => {
        const returnRequest = currentCommunityEditReturnRequest();
        if (
            returnRequest?.entityKey !== `${entityTypeName}:${entityId}` ||
            returnRequest.fieldKey !== (fieldKey ?? '') ||
            returnRequest.sectionKey !== (sectionKey ?? '')
        ) {
            return;
        }

        openDialog();
        returnRequest.clear();
    }, [entityId, entityTypeName, fieldKey, openDialog, sectionKey]);

    const triggerProps = {
        'aria-expanded': open,
        'aria-haspopup': 'dialog',
        onClick: handleTriggerClick,
    } satisfies Pick<
        ButtonHTMLAttributes<HTMLButtonElement>,
        'aria-expanded' | 'aria-haspopup' | 'onClick'
    >;

    return (
        <>
            {buttonStyle === 'card' ? (
                <CommunitySuggestionCard
                    {...triggerProps}
                    className={className}
                    title={triggerLabel}
                />
            ) : buttonStyle === 'icon' ? (
                <IconButton
                    {...triggerProps}
                    className={cx('shrink-0', className)}
                    title={triggerLabel}
                    type="button"
                    variant="plain"
                >
                    <Edit className="size-4" />
                </IconButton>
            ) : (
                <Button
                    {...triggerProps}
                    className={className}
                    size="sm"
                    startDecorator={<Edit className="size-4" />}
                    type="button"
                    variant={buttonStyle === 'plain' ? 'plain' : 'outlined'}
                >
                    {triggerLabel}
                </Button>
            )}
            {hasOpened ? (
                <CommunityEditDialog
                    {...props}
                    onOpenChange={setOpen}
                    open={open}
                />
            ) : null}
        </>
    );
}
