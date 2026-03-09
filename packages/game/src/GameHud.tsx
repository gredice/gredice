'use client';

import type { GameSceneProps } from './GameScene';
import { AccountHud } from './hud/AccountHud';
import { AdventHud } from './hud/AdventHud';
import { AudioHud } from './hud/AudioHud';
import { CameraHud } from './hud/CameraHud';
import { DayNightCycleHud } from './hud/DayNightCycleHud';
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

export function GameHud({ flags }: { flags: GameSceneProps['flags'] }) {
    const isCloseup = useGameState((state) => state.view) === 'closeup';

    return (
        <>
            <div
                className="absolute flex flex-col items-start gap-2"
                style={{
                    top: 'calc(0.5rem + env(safe-area-inset-top, 0px))',
                    left: 'calc(0.5rem + env(safe-area-inset-left, 0px))',
                }}
            >
                <AccountHud />
                {!isCloseup && <GameModeHud />}
                {!isCloseup && <AdventHud />}
                {!isCloseup && <InventoryHud />}
                <ShoppingCartHud />
            </div>
            <div
                className="absolute flex items-end flex-col-reverse md:flex-row gap-1 md:gap-2"
                style={{
                    top: 'calc(0.5rem + env(safe-area-inset-top, 0px))',
                    right: 'calc(0.5rem + env(safe-area-inset-right, 0px))',
                }}
            >
                <WeatherHud />
                <SunflowersHud />
            </div>
            {!isCloseup && <DayNightCycleHud />}
            <div
                className="absolute flex flex-col left-0 right-0 md:flex-row md:justify-between md:items-end pointer-events-none"
                style={{ bottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
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
