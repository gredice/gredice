'use client';

import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@signalco/ui-primitives/Menu";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { BookA, MoreHorizontal, Edit } from "@signalco/ui-icons";
import { SelectEntityType } from "@gredice/storage";
import { KnownPages } from "../../../../src/KnownPages";

export function EntityTypeMenu({ entityType }: { entityType: SelectEntityType }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <IconButton variant="plain" title="Više opcija">
                    <MoreHorizontal className='size-5' />
                </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem
                    href={KnownPages.DirectoryEntityTypeEdit(entityType.name)}
                    startDecorator={<Edit className='size-5 shrink-0' />}>
                    Uredi tip zapisa
                </DropdownMenuItem>
                <DropdownMenuItem
                    href={KnownPages.DirectoryEntityTypeAttributeDefinitions(entityType.name)}
                    startDecorator={<BookA className='size-5 shrink-0' />}>
                    Atributi
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}