'use client';

import type { IconButtonButtonProps } from '@gredice/ui/IconButton';
import { IconButton } from '@gredice/ui/IconButton';
import { Add } from '@gredice/ui/icons';

type OperationCreateTriggerProps = Omit<
    IconButtonButtonProps,
    'aria-label' | 'children' | 'title' | 'variant'
>;

export function OperationCreateTrigger(
    triggerProps: OperationCreateTriggerProps,
) {
    return (
        <IconButton
            {...triggerProps}
            aria-label="Dodaj radnju"
            title="Dodaj radnju"
            type="button"
            variant="outlined"
        >
            <Add className="size-4" />
        </IconButton>
    );
}
