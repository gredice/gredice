'use client';

import { cx } from '@gredice/ui/utils';
import { useState } from 'react';
import type { GameSceneProps } from './GameScene';
import { useCurrentGarden } from './hooks/useCurrentGarden';
import { AccountHud } from './hud/AccountHud';
import { AdventHud } from './hud/AdventHud';
import { AudioHud } from './hud/AudioHud';
import { CameraHud } from './hud/CameraHud';
import { ControlsTooltipHud } from './hud/ControlsTooltipHud';
import { DebugHud } from './hud/DebugHud';
import { GardenVisitSummaryHighlightHud } from './hud/GardenVisitSummaryHighlightHud';
import { GardenVisitSummaryModal } from './hud/GardenVisitSummaryModal';
import { InventoryHud } from './hud/InventoryHud';
import { ItemsHud } from './hud/ItemsHud';
import { OutletHud } from './hud/OutletHud';
import { PaymentSuccessfulMessage } from './hud/PaymentSuccessfulMessage';
import { RaisedBedFieldHud } from './hud/RaisedBedFieldHud';
import { SandboxBlockTrashDropTarget } from './hud/SandboxBlockTrashDropTarget';
import { SandboxEnvironmentHud } from './hud/SandboxEnvironmentHud';
import { ShoppingCartHud } from './hud/ShoppingCartHud';
import { SunflowersHud } from './hud/SunflowersHud';
import { WeatherHud } from './hud/WeatherHud';
import { WelcomeMessage } from './hud/WelcomeMessage';
import { WhatsNewWidget } from './hud/WhatsNewWidget';
import { AdventModal } from './modals/advent/AdventModal';
import { GiftBoxModal } from './modals/GiftBoxModal';
import { OverviewModal } from './modals/OverviewModal';
import { useGameState } from './useGameState';

export const gameHudBottomBarClassName =
    'pointer-events-none absolute bottom-0 left-0 right-0 flex flex-col items-center md:block';

export const gameHudBottomControlsClassName =
    'self-start flex flex-row items-end justify-start p-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 motion-safe:ease-out md:absolute md:bottom-0 md:left-0';

const gameHudEntranceClassName =
    'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300 motion-safe:ease-out';

export function GameHud({
    debugHud,
    flags,
    noWeather,
}: {
    debugHud?: boolean;
    flags: GameSceneProps['flags'];
    noWeather?: boolean;
}) {
    const [welcomeConfirmed, setWelcomeConfirmed] = useState(false);
    const [visitSummaryConfirmation, setVisitSummaryConfirmation] = useState<{
        confirmed: boolean;
        gardenId: number | null;
    }>({ confirmed: false, gardenId: null });
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
    const currentGardenId = currentGarden?.id ?? null;
    const visitSummaryConfirmed =
        visitSummaryConfirmation.confirmed &&
        visitSummaryConfirmation.gardenId === currentGardenId;
    const visitSummaryEnabled =
        welcomeConfirmed && !visitSummaryConfirmed && !isSandbox;
    const openingFlowComplete =
        welcomeConfirmed && (isSandbox || visitSummaryConfirmed);

    return (
        <>
            <div
                className={cx(
                    'absolute top-2 left-2 flex flex-col items-start gap-2',
                    gameHudEntranceClassName,
                    'motion-safe:slide-in-from-left-4',
                )}
            >
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
                {!isSandbox && (
                    <div className={closeupHiddenHudClassName}>
                        <OutletHud />
                    </div>
                )}
            </div>
            <div
                className={cx(
                    'absolute top-2 right-2 flex items-end flex-col-reverse gap-1 md:flex-row md:gap-2',
                    gameHudEntranceClassName,
                    'motion-safe:slide-in-from-right-4',
                )}
            >
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
            {!isLocalSandbox && (
                <>
                    <WelcomeMessage
                        onClosed={() => setWelcomeConfirmed(true)}
                    />
                    <GardenVisitSummaryModal
                        enabled={visitSummaryEnabled}
                        onClosed={() =>
                            setVisitSummaryConfirmation({
                                confirmed: true,
                                gardenId: currentGardenId,
                            })
                        }
                    />
                    <GardenVisitSummaryHighlightHud />
                    <WhatsNewWidget enabled={openingFlowComplete} />
                </>
            )}
            {!isLocalSandbox && <PaymentSuccessfulMessage />}
            {debugHud && <DebugHud />}
        </>
    );
}
