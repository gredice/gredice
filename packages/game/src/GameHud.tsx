'use client';

import { DayNightCycleHud } from './hud/DayNightCycleHud';
import { AccountHud } from './hud/AccountHud';
import { SunflowersHud } from './hud/SunflowersHud';
import { OverviewModal } from './modals/OverviewModal';
import { WeatherHud } from './hud/WeatherHud';
import { ItemsHud } from './hud/ItemsHud';
import { CameraHud } from './hud/CameraHud';
import { AudioHud } from './hud/AudioHud';
import { GameModeHud } from './hud/GameModeHud';
import { WelcomeMessage } from './hud/WelcomeMessage';
import { ShoppingCartHud } from './hud/ShoppingCartHud';
import { RaisedBedFieldHud } from './hud/RaisedBedFieldHud';
import { PaymentSuccessfulMessage } from './hud/PaymentSuccessfulMessage';
import { GameSceneProps } from './GameScene';
import { DebugHud } from './hud/DebugHud';

export function GameHud({ flags }: { flags: GameSceneProps['flags'] }) {
    return (
        <>
            <div className='absolute top-2 left-2 flex flex-col items-start gap-2'>
                <AccountHud />
                <GameModeHud />
                <ShoppingCartHud />
            </div>
            <div className='absolute top-2 right-2 flex items-end flex-col-reverse md:flex-row gap-1 md:gap-2'>
                <WeatherHud />
                <SunflowersHud />
            </div>
            <DayNightCycleHud />
            <div className='absolute bottom-0 flex flex-col left-0 right-0 md:flex-row md:justify-between md:items-end pointer-events-none'>
                <div className='p-2 flex flex-row'>
                    <CameraHud />
                    <AudioHud />
                </div>
                <ItemsHud />
                <div className='hidden md:block' />
            </div>
            <RaisedBedFieldHud
                flags={flags}
            />
            <OverviewModal />
            <WelcomeMessage />
            <PaymentSuccessfulMessage />
            {Boolean(flags?.enableDebugHudFlag) && <DebugHud />}
        </>
    );
}