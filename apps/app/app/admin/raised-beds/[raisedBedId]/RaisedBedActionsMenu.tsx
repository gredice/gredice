'use client';

import { MoreHorizontal } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@signalco/ui-primitives/Menu';
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
