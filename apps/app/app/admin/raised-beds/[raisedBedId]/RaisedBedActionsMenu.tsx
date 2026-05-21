'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { MoreHorizontal } from '@gredice/ui/icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import { MergeRaisedBedsForm } from './MergeRaisedBedsForm';

export function RaisedBedActionsMenu({
    targetRaisedBedId,
}: {
    targetRaisedBedId: number;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <IconButton variant="plain" title="Više opcija">
                    <MoreHorizontal className="size-5" />
                </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-4">
                <MergeRaisedBedsForm targetRaisedBedId={targetRaisedBedId} />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
