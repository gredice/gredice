'use client';

import type { SelectEntityType } from '@gredice/storage';
import { BookA, Edit, MoreHorizontal } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@signalco/ui-primitives/Menu';
import { KnownPages } from '../../../../src/KnownPages';

export function EntityTypeMenu({
    entityType,
}: {
    entityType: SelectEntityType;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <IconButton variant="plain" title="Više opcija">
                    <MoreHorizontal className="size-5" />
                </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem
                    href={KnownPages.DirectoryEntityTypeEdit(entityType.name)}
                    startDecorator={<Edit className="size-5 shrink-0" />}
                >
                    Uredi tip zapisa
                </DropdownMenuItem>
                <DropdownMenuItem
                    href={KnownPages.DirectoryEntityTypeAttributeDefinitions(
                        entityType.name,
                    )}
                    startDecorator={<BookA className="size-5 shrink-0" />}
                >
                    Atributi
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
