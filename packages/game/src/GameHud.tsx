'use client';

import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { useMemo } from 'react';
import type { GameSceneProps } from './GameScene';
import { useCurrentGarden } from './hooks/useCurrentGarden';
import { AccountHud } from './hud/AccountHud';
import { AudioHud } from './hud/AudioHud';
import { CameraHud } from './hud/CameraHud';
import { DayNightCycleHud } from './hud/DayNightCycleHud';
import { DebugHud } from './hud/DebugHud';
import { GameModeHud } from './hud/GameModeHud';
import { ItemsHud } from './hud/ItemsHud';
import { PaymentSuccessfulMessage } from './hud/PaymentSuccessfulMessage';
import { RaisedBedFieldHud } from './hud/RaisedBedFieldHud';
import { ShoppingCartHud } from './hud/ShoppingCartHud';
import { SunflowersHud } from './hud/SunflowersHud';
import { WeatherHud } from './hud/WeatherHud';
import { WelcomeMessage } from './hud/WelcomeMessage';
import { OverviewModal } from './modals/OverviewModal';
import type { Block } from './types/Block';

export function useView() {
    const { data: garden } = useCurrentGarden();
    const [blockAlias, setBlockAlias] = useSearchParam('gredica');

    function handleViewChange(blockId?: string | null) {
        if (!blockId) {
            setBlockAlias(undefined);
        }

        const raisedBed = garden?.raisedBeds.find(
            (raisedBed) => raisedBed.blockId === blockId,
        );
        if (raisedBed) {
            setBlockAlias(raisedBed.name ?? undefined);
        }
    }

    const data: {
        view: 'normal' | 'closeup';
        closeupBlock: Block | null;
    } = useMemo(() => {
        const activeRaisedBed =
            garden?.raisedBeds.find(
                (raisedBed) => raisedBed.name === blockAlias,
            ) ?? null;
        const activeBlock =
            garden?.stacks
                .flat()
                .flatMap((stack) => stack.blocks)
                .find((block) => block.id === activeRaisedBed?.blockId) ?? null;

        return {
            view: blockAlias ? 'closeup' : 'normal',
            closeupBlock: activeBlock,
        };
    }, [blockAlias, garden]);

    return [data, handleViewChange] as const;
}

export function GameHud({ flags }: { flags: GameSceneProps['flags'] }) {
    const isCloseup = useView()[0].view === 'closeup';

    return (
        <>
            <div className="absolute top-2 left-2 flex flex-col items-start gap-2">
                <AccountHud />
                {!isCloseup && <GameModeHud />}
                <ShoppingCartHud />
            </div>
            <div className="absolute top-2 right-2 flex items-end flex-col-reverse md:flex-row gap-1 md:gap-2">
                <WeatherHud />
                <SunflowersHud />
            </div>
            {!isCloseup && <DayNightCycleHud />}
            <div className="absolute bottom-0 flex flex-col left-0 right-0 md:flex-row md:justify-between md:items-end pointer-events-none">
                <div className="p-2 flex flex-row">
                    <CameraHud />
                    <AudioHud />
                </div>
                <ItemsHud />
                <div className="hidden md:block" />
            </div>
            <RaisedBedFieldHud flags={flags} />
            <OverviewModal />
            <WelcomeMessage />
            <PaymentSuccessfulMessage />
            {Boolean(flags?.enableDebugHudFlag) && <DebugHud />}
        </>
    );
}
