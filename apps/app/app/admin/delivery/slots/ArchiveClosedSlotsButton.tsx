'use client';

import { ArchiveIcon } from '@gredice/ui/ArchiveIcon';
import { DotIndicator } from '@signalco/ui-primitives/DotIndicator';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { useTransition } from 'react';
import { archiveClosedTimeSlotsAction } from './actions';

interface ArchiveClosedSlotsButtonProps {
    slotIds: number[];
}

export function ArchiveClosedSlotsButton({
    slotIds,
}: ArchiveClosedSlotsButtonProps) {
    const [isPending, startTransition] = useTransition();

    const handleArchiveAll = () => {
        startTransition(async () => {
            const result = await archiveClosedTimeSlotsAction(slotIds);
            if (!result.success) {
                alert(result.message);
            }
        });
    };

    return (
        <IconButton
            variant="outlined"
            color="neutral"
            size="lg"
            title="Arhivirati zatvorene termine"
            onClick={handleArchiveAll}
            disabled={isPending || slotIds.length === 0}
            loading={isPending}
        >
            <div className="relative">
                <ArchiveIcon className="shrink-0 size-5" />
                {slotIds.length > 0 && (
                    <div className="absolute -top-6 -right-6">
                        <DotIndicator
                            size={24}
                            color="info"
                            // biome-ignore lint/complexity/noUselessFragments: This is needed to properly center the content within the DotIndicator
                            content={<>{slotIds.length.toString()}</>}
                        />
                    </div>
                )}
            </div>
        </IconButton>
    );
}
