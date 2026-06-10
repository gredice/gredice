'use client';

import type { AutomationDefinitionStatus } from '@gredice/storage';
import { ArchiveIcon } from '@gredice/ui/ArchiveIcon';
import { IconButton } from '@gredice/ui/IconButton';
import { MoreHorizontal, ToggleLeft, ToggleRight } from '@gredice/ui/icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';

export function AutomationActionsMenu({
    disabled,
    onStatusChange,
    status,
}: {
    disabled?: boolean;
    onStatusChange(status: AutomationDefinitionStatus): void;
    status: AutomationDefinitionStatus;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <IconButton
                    disabled={disabled}
                    size="sm"
                    title="Više opcija"
                    variant="plain"
                >
                    <MoreHorizontal className="size-4" />
                </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                {status === 'enabled' ? (
                    <DropdownMenuItem
                        disabled={disabled}
                        onSelect={() => onStatusChange('disabled')}
                        startDecorator={<ToggleLeft className="size-4" />}
                    >
                        Isključi
                    </DropdownMenuItem>
                ) : (
                    <DropdownMenuItem
                        disabled={disabled}
                        onSelect={() => onStatusChange('enabled')}
                        startDecorator={<ToggleRight className="size-4" />}
                    >
                        Uključi
                    </DropdownMenuItem>
                )}
                {status !== 'archived' ? (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-red-700 focus:bg-red-50 focus:text-red-700 dark:text-red-300 dark:focus:bg-red-950"
                            disabled={disabled}
                            onSelect={() => onStatusChange('archived')}
                            startDecorator={<ArchiveIcon className="size-4" />}
                        >
                            Arhiviraj
                        </DropdownMenuItem>
                    </>
                ) : null}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
