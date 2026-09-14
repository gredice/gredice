'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Megaphone } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import { useEffect, useRef, useState } from 'react';
import type { GardenViewMode } from './gardenViewMode';
import { useCurrentGarden } from './hooks/useCurrentGarden';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useMarkTutorialChecklistTaskReady } from './hooks/useTutorialChecklist';
import { AccountHud } from './hud/AccountHud';
import { AdventHud } from './hud/AdventHud';
import { AudioHud } from './hud/AudioHud';
import { CameraHud } from './hud/CameraHud';
import { ControlsTooltipHud } from './hud/ControlsTooltipHud';
import { HudListItemPresence } from './hud/components/HudListItemPresence';
import { DebugHudDynamic } from './hud/DebugHudDynamic';
import { GardenAvatarHud } from './hud/GardenAvatarHud';
import { GardenTargetHighlightHud } from './hud/GardenTargetHighlightHud';
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
import { TemporaryAccountAuthHud } from './hud/TemporaryAccountAuthHud';
import { TutorialChecklistHud } from './hud/TutorialChecklistHud';
import { WeatherHud } from './hud/WeatherHud';
import { WelcomeMessage } from './hud/WelcomeMessage';
import { WhatsNewWidget } from './hud/WhatsNewWidget';
import { AdventModal } from './modals/advent/AdventModal';
import { GiftBoxModal } from './modals/GiftBoxModal';
import { OverviewModal } from './modals/OverviewModal';
import { WoodenSignModal } from './modals/WoodenSignModal';
import { GardenStructureVerticalSliceHudDynamic } from './structures/GardenStructureVerticalSliceHudDynamic';
import type { GardenStructureProfileFixtureDescriptor } from './structures/gardenStructureProfileFixtureDescriptor';
import type { GardenStructureSemanticPlan } from './structures/structurePlanTypes';
import { useGameState } from './useGameState';

export const gameHudBottomBarClassName =
    'pointer-events-none absolute bottom-[var(--game-safe-area-bottom,0px)] left-[var(--game-safe-area-left,0px)] right-[var(--game-safe-area-right,0px)] flex flex-col items-center md:block';

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
    gardenStructureBuildEnabled = false,
    gardenStructureDebugFixture,
    gardenStructureDebugPlan,
    gardenStructureProfileFixture,
    noWeather,
    suppressOpeningHud,
    viewMode = '3d',
}: {
    debugHud?: boolean;
    gardenStructureBuildEnabled?: boolean;
    gardenStructureDebugFixture?: boolean;
    gardenStructureDebugPlan?: GardenStructureSemanticPlan;
    gardenStructureProfileFixture?: GardenStructureProfileFixtureDescriptor;
    noWeather?: boolean;
    suppressOpeningHud?: boolean;
    viewMode?: GardenViewMode;
}) {
    const [welcomeConfirmed, setWelcomeConfirmed] = useState(false);
    const [whatsNewOpenRequestId, setWhatsNewOpenRequestId] = useState(0);
    const [
        raisedBedOnboardingConfirmation,
        setRaisedBedOnboardingConfirmation,
    ] = useState<{
        confirmed: boolean;
        gardenId: number | null;
    }>({ confirmed: false, gardenId: null });
    const isCloseup = useGameState((state) => state.view) === 'closeup';
    const gardenAvatarView = useGameState((state) => state.gardenAvatarView);
    const structureBuildSession = useGameState(
        (state) => state.structureBuildSession,
    );
    const restoreStructureEntryFocusRef = useRef(false);
    useEffect(() => {
        if (structureBuildSession) {
            restoreStructureEntryFocusRef.current = true;
            return;
        }
        if (!restoreStructureEntryFocusRef.current) {
            return;
        }
        restoreStructureEntryFocusRef.current = false;
        const frame = requestAnimationFrame(() =>
            document
                .querySelector<HTMLButtonElement>(
                    '[data-testid="garden-structure-build-entry"]',
                )
                ?.focus(),
        );
        return () => cancelAnimationFrame(frame);
    }, [structureBuildSession]);
    const { data: currentGarden } = useCurrentGarden();
    const { data: currentUser } = useCurrentUser();
    const markTutorialChecklistTaskReady = useMarkTutorialChecklistTaskReady();
    const isSandbox = Boolean(currentGarden?.isSandbox);
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );
    const showAccountEconomy =
        !isLocalSandbox && (!isSandbox || Boolean(currentUser?.isTemporary));
    const showLoadedAccountEconomy =
        Boolean(currentGarden) && showAccountEconomy;
    const closeupHiddenHudClassName = cx(
        'empty:hidden',
        isCloseup && 'hidden md:block',
    );
    const currentGardenId = currentGarden?.id ?? null;
    const openingWelcomeConfirmed =
        Boolean(currentUser?.isTemporary) || welcomeConfirmed;
    const raisedBedOnboardingAvailable = Boolean(currentGarden) && !isSandbox;
    const raisedBedOnboardingChecklistResolved =
        raisedBedOnboardingConfirmation.confirmed &&
        raisedBedOnboardingConfirmation.gardenId === currentGardenId;
    const raisedBedOnboardingEnabled =
        !suppressOpeningHud &&
        openingWelcomeConfirmed &&
        !raisedBedOnboardingChecklistResolved &&
        !isSandbox;
    const openingFlowComplete =
        !suppressOpeningHud &&
        openingWelcomeConfirmed &&
        (isSandbox || raisedBedOnboardingChecklistResolved);
    const whatsNewHudEnabled =
        !isLocalSandbox && !suppressOpeningHud && openingFlowComplete;

    if (gardenStructureBuildEnabled && structureBuildSession) {
        return (
            <>
                <GardenStructureVerticalSliceHudDynamic
                    enabled
                    fixture={gardenStructureDebugFixture}
                    plan={gardenStructureDebugPlan}
                    profileFixture={gardenStructureProfileFixture}
                />
                {debugHud && viewMode === '3d' ? <DebugHudDynamic /> : null}
            </>
        );
    }

    if (gardenAvatarView !== 'overview') {
        // Interacting with a garden box or a sign while walking has to open its
        // modal right away, so those keep rendering without their HUD shells.
        return (
            <>
                {!isLocalSandbox && currentUser?.isTemporary ? (
                    <TemporaryAccountAuthHud />
                ) : null}
                <GardenAvatarHud />
                {showAccountEconomy && <InventoryHud hideTrigger />}
                <WoodenSignModal />
                {debugHud && viewMode === '3d' ? <DebugHudDynamic /> : null}
            </>
        );
    }

    return (
        <SuncokretChatProvider>
            {!isLocalSandbox && currentUser?.isTemporary ? (
                <TemporaryAccountAuthHud />
            ) : null}
            <div
                data-game-hud-top-left
                className={cx(
                    'absolute top-[calc(var(--game-safe-area-top,0px)+0.5rem)] left-[calc(var(--game-safe-area-left,0px)+0.5rem)] flex flex-col items-start gap-2',
                    gameHudEntranceClassName,
                    'motion-safe:slide-in-from-left-4',
                )}
            >
                {!isLocalSandbox && <AccountHud viewMode={viewMode} />}
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
                {!isLocalSandbox && (
                    <TutorialChecklistHud
                        enabled={Boolean(currentGarden) && !isSandbox}
                    />
                )}
                {!isLocalSandbox && (
                    <ShoppingCartHud enabled={showLoadedAccountEconomy} />
                )}
                {showLoadedAccountEconomy && (
                    <div className={closeupHiddenHudClassName}>
                        <AdventHud />
                    </div>
                )}
                {!isLocalSandbox && (
                    <HudListItemPresence
                        className={closeupHiddenHudClassName}
                        visible={showLoadedAccountEconomy}
                    >
                        <InventoryHud />
                    </HudListItemPresence>
                )}
                {!isLocalSandbox && (
                    <OutletHud
                        className={closeupHiddenHudClassName}
                        enabled={showLoadedAccountEconomy}
                    />
                )}
            </div>
            <div
                data-game-hud-top-right
                className={cx(
                    'absolute top-[calc(var(--game-safe-area-top,0px)+0.5rem)] right-[calc(var(--game-safe-area-right,0px)+0.5rem)] flex items-end flex-col-reverse gap-1 md:flex-row md:gap-2',
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
                {showAccountEconomy && <SunflowersHud />}
            </div>
            {currentGarden && !isSandbox && !isLocalSandbox && (
                <div
                    data-game-hud-bottom-right
                    className={cx(
                        'pointer-events-none absolute right-[calc(var(--game-safe-area-right,0px)+0.5rem)] bottom-[calc(var(--game-safe-area-bottom,0px)+0.5rem)] z-40',
                        gameHudEntranceClassName,
                        'motion-safe:slide-in-from-right-4',
                    )}
                >
                    <SuncokretChatHud />
                </div>
            )}
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
                    {viewMode === '3d' ? <AudioHud /> : null}
                    {viewMode === '3d' ? (
                        <ControlsTooltipHud isCloseup={isCloseup} />
                    ) : null}
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
            {!isLocalSandbox && (
                <RaisedBedFieldHud
                    instantTransition={viewMode === '2d'}
                    show2DPlaceholder={viewMode === '2d'}
                />
            )}
            {!isLocalSandbox && <OverviewModal />}
            {!isLocalSandbox && <AdventModal />}
            {!isLocalSandbox && <GiftBoxModal />}
            <WoodenSignModal />
            {!isLocalSandbox && !suppressOpeningHud && (
                <>
                    {!currentUser?.isTemporary && currentUser ? (
                        <WelcomeMessage
                            onClosed={() => setWelcomeConfirmed(true)}
                        />
                    ) : null}
                    <GardenTargetHighlightHud />
                    <WhatsNewWidget
                        enabled={openingFlowComplete}
                        openRequestId={whatsNewOpenRequestId}
                    />
                </>
            )}
            {!isLocalSandbox && <PaymentSuccessfulMessage />}
            {gardenStructureBuildEnabled ? (
                <GardenStructureVerticalSliceHudDynamic
                    enabled
                    fixture={gardenStructureDebugFixture}
                    plan={gardenStructureDebugPlan}
                    profileFixture={gardenStructureProfileFixture}
                />
            ) : null}
            {debugHud && viewMode === '3d' ? <DebugHudDynamic /> : null}
        </SuncokretChatProvider>
    );
}
