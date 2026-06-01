'use client';

import { cx } from '@gredice/ui/utils';
import type { GameSceneProps } from './GameScene';
import { useCurrentGarden } from './hooks/useCurrentGarden';
import { AccountHud } from './hud/AccountHud';
import { AdventHud } from './hud/AdventHud';
import { AudioHud } from './hud/AudioHud';
import { CameraHud } from './hud/CameraHud';
import { ControlsTooltipHud } from './hud/ControlsTooltipHud';
import { DebugHud } from './hud/DebugHud';
import { InventoryHud } from './hud/InventoryHud';
import { ItemsHud } from './hud/ItemsHud';
import { PaymentSuccessfulMessage } from './hud/PaymentSuccessfulMessage';
import { RaisedBedFieldHud } from './hud/RaisedBedFieldHud';
import { SandboxBlockTrashDropTarget } from './hud/SandboxBlockTrashDropTarget';
import { SandboxEnvironmentHud } from './hud/SandboxEnvironmentHud';
import { ShoppingCartHud } from './hud/ShoppingCartHud';
import { SunflowersHud } from './hud/SunflowersHud';
import { WeatherHud } from './hud/WeatherHud';
import { WelcomeMessage } from './hud/WelcomeMessage';
import { AdventModal } from './modals/advent/AdventModal';
import { GiftBoxModal } from './modals/GiftBoxModal';
import { OverviewModal } from './modals/OverviewModal';
import { useGameState } from './useGameState';

export const gameHudBottomBarClassName =
    'pointer-events-none absolute bottom-0 left-0 right-0 flex flex-col items-center md:block';

export const gameHudBottomControlsClassName =
    'flex flex-row items-end p-2 md:absolute md:bottom-0 md:left-0';

export function GameHud({
    flags,
    noWeather,
}: {
    flags: GameSceneProps['flags'];
    noWeather?: boolean;
}) {
    const isCloseup = useGameState((state) => state.view) === 'closeup';
    const { data: currentGarden } = useCurrentGarden();
    // Sandbox ("play") gardens are decoration only: no economy or inventory.
    const isSandbox = Boolean(currentGarden?.isSandbox);
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );
    const closeupHiddenHudClassName = cx(
        'empty:hidden',
        isCloseup && 'hidden md:block',
    );

    return (
        <>
            <div className="absolute top-2 left-2 flex flex-col items-start gap-2">
                {!isLocalSandbox && <AccountHud />}
                {!isSandbox && <ShoppingCartHud />}
                {!isSandbox && (
                    <div className={closeupHiddenHudClassName}>
                        <AdventHud />
                    </div>
                )}
                {!isSandbox && (
                    <div className={closeupHiddenHudClassName}>
                        <InventoryHud />
                    </div>
                )}
            </div>
            <div className="absolute top-2 right-2 flex items-end flex-col-reverse md:flex-row gap-1 md:gap-2">
                <div className={closeupHiddenHudClassName}>
                    {isSandbox ? (
                        <SandboxEnvironmentHud />
                    ) : (
                        <WeatherHud noWeather={noWeather} />
                    )}
                </div>
                {!isSandbox && <SunflowersHud />}
            </div>
            <div className={gameHudBottomBarClassName}>
                <div className={gameHudBottomControlsClassName}>
                    <CameraHud />
                    <AudioHud />
                    <ControlsTooltipHud />
                </div>
                <SandboxBlockTrashDropTarget />
                <ItemsHud />
            </div>
            {!isLocalSandbox && <RaisedBedFieldHud flags={flags} />}
            {!isLocalSandbox && <OverviewModal />}
            {!isLocalSandbox && <AdventModal />}
            {!isLocalSandbox && <GiftBoxModal />}
            {!isLocalSandbox && <WelcomeMessage />}
            {!isLocalSandbox && <PaymentSuccessfulMessage />}
            {Boolean(flags?.enableDebugHudFlag) && <DebugHud />}
        </>
    );
}
