'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Megaphone } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import { useState } from 'react';
import { useCurrentGarden } from './hooks/useCurrentGarden';
import { useMarkTutorialChecklistTaskReady } from './hooks/useTutorialChecklist';
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
import { RaisedBedOnboardingModal } from './hud/RaisedBedOnboardingModal';
import { SandboxEnvironmentHud } from './hud/SandboxEnvironmentHud';
import { ShoppingCartHud } from './hud/ShoppingCartHud';
import { SuncokretChatHud } from './hud/SuncokretChatHud';
import { SuncokretChatProvider } from './hud/SuncokretChatProvider';
import { SunflowersHud } from './hud/SunflowersHud';
import { TutorialChecklistHud } from './hud/TutorialChecklistHud';
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

export const gameHudBottomItemsClassName = 'flex w-full justify-center';

const gameHudEntranceClassName =
    'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300 motion-safe:ease-out';

const gameHudCloseupBottomTransitionClassName =
    'motion-safe:transition-[opacity,transform] motion-safe:duration-300 motion-safe:ease-in-out motion-reduce:transition-none';

export function getGameHudBottomCloseupClassName(isCloseup: boolean) {
    return cx(
        gameHudCloseupBottomTransitionClassName,
        isCloseup
            ? 'pointer-events-none translate-y-[100dvh] opacity-0'
            : 'translate-y-0 opacity-100',
    );
}

export function GameHud({
    debugHud,
    noWeather,
    suppressOpeningHud,
}: {
    debugHud?: boolean;
    noWeather?: boolean;
    suppressOpeningHud?: boolean;
}) {
    const [welcomeConfirmed, setWelcomeConfirmed] = useState(false);
    const [whatsNewOpenRequestId, setWhatsNewOpenRequestId] = useState(0);
    const [visitSummaryConfirmation, setVisitSummaryConfirmation] = useState<{
        confirmed: boolean;
        gardenId: number | null;
    }>({ confirmed: false, gardenId: null });
    const [
        raisedBedOnboardingConfirmation,
        setRaisedBedOnboardingConfirmation,
    ] = useState<{
        confirmed: boolean;
        gardenId: number | null;
    }>({ confirmed: false, gardenId: null });
    const isCloseup = useGameState((state) => state.view) === 'closeup';
    const { data: currentGarden } = useCurrentGarden();
    const markTutorialChecklistTaskReady = useMarkTutorialChecklistTaskReady();
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
    const raisedBedOnboardingAvailable = !isSandbox;
    const visitSummaryConfirmed =
        visitSummaryConfirmation.confirmed &&
        visitSummaryConfirmation.gardenId === currentGardenId;
    const raisedBedOnboardingChecklistResolved =
        raisedBedOnboardingConfirmation.confirmed &&
        raisedBedOnboardingConfirmation.gardenId === currentGardenId;
    const visitSummaryEnabled =
        !suppressOpeningHud &&
        welcomeConfirmed &&
        !visitSummaryConfirmed &&
        !isSandbox;
    const visitSummaryStageComplete =
        !suppressOpeningHud &&
        welcomeConfirmed &&
        (isSandbox || visitSummaryConfirmed);
    const raisedBedOnboardingEnabled =
        visitSummaryStageComplete &&
        !raisedBedOnboardingChecklistResolved &&
        !isSandbox;
    const openingFlowComplete =
        !suppressOpeningHud &&
        visitSummaryStageComplete &&
        (isSandbox || raisedBedOnboardingChecklistResolved);
    const whatsNewHudEnabled =
        !isLocalSandbox && !suppressOpeningHud && openingFlowComplete;

    return (
        <SuncokretChatProvider>
            <div
                className={cx(
                    'absolute top-2 left-2 flex flex-col items-start gap-2',
                    gameHudEntranceClassName,
                    'motion-safe:slide-in-from-left-4',
                )}
            >
                {!isLocalSandbox && <AccountHud />}
                {!isLocalSandbox && raisedBedOnboardingAvailable && (
                    <RaisedBedOnboardingModal
                        autoOpen={raisedBedOnboardingEnabled}
                        enabled
                        onApplied={() =>
                            markTutorialChecklistTaskReady.mutate(
                                'complete-first-raised-bed-onboarding',
                            )
                        }
                        onResolved={() =>
                            setRaisedBedOnboardingConfirmation({
                                confirmed: true,
                                gardenId: currentGardenId,
                            })
                        }
                    />
                )}
                {!isLocalSandbox && !isSandbox && <TutorialChecklistHud />}
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
                {!isSandbox && !isLocalSandbox && <SuncokretChatHud />}
            </div>
            <div className={gameHudBottomBarClassName}>
                <div
                    data-game-hud-bottom-controls
                    aria-hidden={isCloseup}
                    inert={isCloseup ? true : undefined}
                    className={cx(
                        gameHudBottomControlsClassName,
                        getGameHudBottomCloseupClassName(isCloseup),
                    )}
                >
                    <CameraHud />
                    <AudioHud />
                    <ControlsTooltipHud />
                    {whatsNewHudEnabled && (
                        <IconButton
                            title="Što je novo"
                            variant="plain"
                            onClick={() =>
                                setWhatsNewOpenRequestId(
                                    (current) => current + 1,
                                )
                            }
                            className="pointer-events-auto hover:bg-muted"
                        >
                            <Megaphone className="size-5" />
                        </IconButton>
                    )}
                </div>
                <div
                    data-game-hud-bottom-items
                    aria-hidden={isCloseup}
                    inert={isCloseup ? true : undefined}
                    className={cx(
                        gameHudBottomItemsClassName,
                        getGameHudBottomCloseupClassName(isCloseup),
                    )}
                >
                    <ItemsHud />
                </div>
            </div>
            {!isLocalSandbox && <RaisedBedFieldHud />}
            {!isLocalSandbox && <OverviewModal />}
            {!isLocalSandbox && <AdventModal />}
            {!isLocalSandbox && <GiftBoxModal />}
            {!isLocalSandbox && !suppressOpeningHud && (
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
                    <WhatsNewWidget
                        enabled={openingFlowComplete}
                        openRequestId={whatsNewOpenRequestId}
                    />
                </>
            )}
            {!isLocalSandbox && <PaymentSuccessfulMessage />}
            {debugHud && <DebugHud />}
        </SuncokretChatProvider>
    );
}
