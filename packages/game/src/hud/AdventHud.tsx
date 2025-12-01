'use client';

import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Stack } from '@signalco/ui-primitives/Stack';
import { SantaCapIcon } from '../icons/SantaCap';
import { HudCard } from './components/HudCard';

export function AdventHud() {
    const [, setAdventParam] = useSearchParam('advent');

    // Only show during December
    const now = new Date();
    const isDecember = now.getMonth() === 11;
    const dayOfMonth = now.getDate();
    const isAdventPeriod = isDecember && dayOfMonth <= 24;

    if (!isAdventPeriod) {
        return null;
    }

    return (
        <HudCard open position="floating" className="static p-0.5">
            <IconButton
                variant="plain"
                className="rounded-full size-10 border-[1.5px] border-white dark:border-green-950 bg-green-500 dark:bg-green-700 hover:bg-green-600"
                title="Adventski kalendar"
                onClick={() => setAdventParam('open')}
            >
                <SantaCapIcon className="size-6 shrink-0" />
            </IconButton>
        </HudCard>
    );
}
