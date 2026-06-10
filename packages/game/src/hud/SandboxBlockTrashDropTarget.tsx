'use client';

import { Delete } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import { useIsSandboxGarden } from '../hooks/useCurrentGarden';
import { sandboxBlockTrashDropTargetAttribute } from '../sandboxBlockTrashDropTarget';
import { useGameState } from '../useGameState';

export function SandboxBlockTrashDropTarget() {
    const isSandbox = useIsSandboxGarden();
    const pickupBlock = useGameState((state) => state.pickupBlock);
    const active = useGameState(
        (state) => state.sandboxBlockTrashDropTargetActive,
    );

    if (!isSandbox || !pickupBlock) {
        return null;
    }

    return (
        <div
            aria-hidden="true"
            {...{ [sandboxBlockTrashDropTargetAttribute]: 'true' }}
            className={cx(
                'pointer-events-none mx-auto mb-4 grid size-16 place-items-center rounded-full border-2 shadow-xl backdrop-blur-md transition duration-150 ease-out md:size-[4.5rem]',
                active
                    ? 'scale-110 border-red-200 bg-red-600 text-white shadow-red-950/25'
                    : 'scale-100 border-red-200 bg-white/95 text-red-600 shadow-black/20',
            )}
        >
            <Delete className="size-7 md:size-8" strokeWidth={2.4} />
        </div>
    );
}
