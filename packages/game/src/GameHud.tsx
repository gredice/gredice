'use client';

import { cx } from '@gredice/ui/utils';
import type { GameSceneProps } from './GameScene';
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
    const closeupHiddenHudClassName = cx(
        'empty:hidden',
        isCloseup && 'hidden md:block',
    );

    return (
        <>
            <div className="absolute top-2 left-2 flex flex-col items-start gap-2">
                <AccountHud />
                <ShoppingCartHud />
                <div className={closeupHiddenHudClassName}>
                    <AdventHud />
                </div>
                <div className={closeupHiddenHudClassName}>
                    <InventoryHud />
                </div>
            </div>
            <div className="absolute top-2 right-2 flex items-end flex-col-reverse md:flex-row gap-1 md:gap-2">
                <div className={closeupHiddenHudClassName}>
                    <WeatherHud noWeather={noWeather} />
                </div>
                <SunflowersHud />
            </div>
            <div className={gameHudBottomBarClassName}>
                <div className={gameHudBottomControlsClassName}>
                    <CameraHud />
                    <AudioHud />
                    <ControlsTooltipHud />
                </div>
                <ItemsHud />
            </div>
            <RaisedBedFieldHud flags={flags} />
            <OverviewModal />
            <AdventModal />
            <GiftBoxModal />
            <WelcomeMessage />
            <PaymentSuccessfulMessage />
            {Boolean(flags?.enableDebugHudFlag) && <DebugHud />}
        </>
    );
}
