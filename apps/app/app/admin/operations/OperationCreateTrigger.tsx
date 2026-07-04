'use client';

import type { IconButtonButtonProps } from '@gredice/ui/IconButton';
import { IconButton } from '@gredice/ui/IconButton';
import { Add, Layers } from '@gredice/ui/icons';

type OperationCreateTriggerMode = 'single' | 'bulk';
type OperationCreateTriggerProps = Omit<
    IconButtonButtonProps,
    'aria-label' | 'children' | 'title' | 'variant'
> & {
    mode: OperationCreateTriggerMode;
};

const triggerConfig = {
    single: {
        Icon: Add,
        label: 'Dodaj jednu radnju',
    },
    bulk: {
        Icon: Layers,
        label: 'Dodaj više radnji',
    },
} satisfies Record<
    OperationCreateTriggerMode,
    {
        Icon: typeof Add;
        label: string;
    }
>;

export function OperationCreateTrigger({
    mode,
    ...triggerProps
}: OperationCreateTriggerProps) {
    const { Icon, label } = triggerConfig[mode];

    return (
        <IconButton
            {...triggerProps}
            aria-label={label}
            title={label}
            type="button"
            variant="outlined"
        >
            <Icon className="size-4" />
        </IconButton>
    );
}
