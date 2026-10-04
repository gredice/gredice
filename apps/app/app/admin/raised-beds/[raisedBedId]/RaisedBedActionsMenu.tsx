'use client';

import { isRaisedBedAbandoned } from '@gredice/js/raisedBeds';
import { IconButton } from '@gredice/ui/IconButton';
import { MoreHorizontal } from '@gredice/ui/icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import { AbandonRaisedBedButton } from './AbandonRaisedBedButton';
import { MergeRaisedBedsForm } from './MergeRaisedBedsForm';

export function RaisedBedActionsMenu({
    accountId,
    gardenId,
    raisedBedName,
    status,
    targetRaisedBedId,
}: {
    accountId: string | null;
    gardenId: number | null;
    raisedBedName: string;
    status: string;
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
                <AbandonRaisedBedButton
                    disabled={!accountId || !gardenId}
                    isAbandoned={isRaisedBedAbandoned(status)}
                    raisedBedId={targetRaisedBedId}
                    raisedBedName={raisedBedName}
                />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
