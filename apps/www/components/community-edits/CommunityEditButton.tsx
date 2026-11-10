'use client';

import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Add, Edit } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import dynamic from 'next/dynamic';
import { type MouseEvent, useEffect, useState } from 'react';
import type { CommunityEditButtonProps } from './CommunityEditButton.types';
import { currentCommunityEditReturnRequest } from './communityEditContext';

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
    const [open, setOpen] = useState(false);
    const [hasOpened, setHasOpened] = useState(false);
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

        setHasOpened(true);
        setOpen(true);
        returnRequest.clear();
    }, [entityId, entityTypeName, fieldKey, sectionKey]);

    function handleOpen(event: MouseEvent<HTMLButtonElement>) {
        // The dialog mounts on demand. Keep its return-focus target stable,
        // including in browsers that do not focus buttons on pointer clicks.
        event.currentTarget.focus({ preventScroll: true });
        setHasOpened(true);
        setOpen(true);
    }

    return (
        <>
            {buttonStyle !== 'icon' ? (
                <Button
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    className={cx(
                        buttonStyle === 'card' &&
                            'h-auto min-h-12 w-full justify-start gap-2 whitespace-normal rounded-lg border-dashed border-muted-foreground/40 bg-card/40 p-3 text-left font-normal hover:border-muted-foreground/60 hover:bg-card/70',
                        className,
                    )}
                    color={buttonStyle === 'card' ? 'neutral' : undefined}
                    onClick={handleOpen}
                    size="sm"
                    startDecorator={
                        buttonStyle === 'card' ? (
                            <Add aria-hidden className="size-4 shrink-0" />
                        ) : (
                            <Edit className="size-4" />
                        )
                    }
                    type="button"
                    variant="outlined"
                >
                    {triggerLabel}
                </Button>
            ) : (
                <IconButton
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    className={cx('shrink-0', className)}
                    onClick={handleOpen}
                    title={triggerLabel}
                    type="button"
                    variant="plain"
                >
                    <Edit className="size-4" />
                </IconButton>
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
