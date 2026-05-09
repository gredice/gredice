'use client';

import { cx } from '@signalco/ui-primitives/cx';
import type { GameSceneProps } from './GameScene';
import { AccountHud } from './hud/AccountHud';
import { AdventHud } from './hud/AdventHud';
import { AudioHud } from './hud/AudioHud';
import { CameraHud } from './hud/CameraHud';
import { DebugHud } from './hud/DebugHud';
import { GameModeHud } from './hud/GameModeHud';
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

export function GameHud({
    flags,
    noWeather,
}: {
    flags: GameSceneProps['flags'];
    noWeather?: boolean;
}) {
    const isCloseup = useGameState((state) => state.view) === 'closeup';

    return (
        <>
            <div className="absolute top-2 left-2 flex flex-col items-start gap-2">
                <AccountHud />
                <div className={cx(isCloseup && 'hidden md:block')}>
                    <GameModeHud />
                </div>
                <div className={cx(isCloseup && 'hidden md:block')}>
                    <AdventHud />
                </div>
                <div className={cx(isCloseup && 'hidden md:block')}>
                    <InventoryHud />
                </div>
                <div className={cx(isCloseup && 'hidden md:block')}>
                    <ShoppingCartHud />
                </div>
            </div>
            <div className="absolute top-2 right-2 flex items-end flex-col-reverse md:flex-row gap-1 md:gap-2">
                <div className={cx(isCloseup && 'hidden md:block')}>
                    <WeatherHud noWeather={noWeather} />
                </div>
                <SunflowersHud />
            </div>
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
            <AdventModal />
            <GiftBoxModal />
            <WelcomeMessage />
            <PaymentSuccessfulMessage />
            {Boolean(flags?.enableDebugHudFlag) && <DebugHud />}
        </>
    );
}
