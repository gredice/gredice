'use client';

import { IconButton } from '@gredice/ui/IconButton';
import {
    ArrowUp,
    ChevronsDown,
    Close,
    Eye,
    Footprints,
    LogOut,
    UserCircle,
    ZoomIn,
} from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import { type PointerEvent, useEffect } from 'react';
import { useGameState } from '../useGameState';
import { GardenAvatarJoystick } from './GardenAvatarJoystick';
import { useGardenAvatarTouchControls } from './gardenAvatarTouchControls';

const avatarHudButtonClassName =
    'pointer-events-auto border border-border/60 bg-background/85 shadow-lg backdrop-blur-md hover:bg-muted active:scale-95 touch-none';
const avatarTouchActionButtonClassName =
    'pointer-events-auto size-14 touch-none rounded-full border border-border/60 bg-background/85 shadow-lg backdrop-blur-md active:scale-95';

export function GardenAvatarHud() {
    const showTouchControls = useGardenAvatarTouchControls();
    const view = useGameState((state) => state.gardenAvatarView);
    const boatId = useGameState((state) => state.gardenAvatarBoatId);
    const aimedBoatId = useGameState((state) => state.gardenAvatarAimedBoatId);
    const setView = useGameState((state) => state.setGardenAvatarView);
    const setBoatId = useGameState((state) => state.setGardenAvatarBoatId);
    const setSprintInput = useGameState(
        (state) => state.setGardenAvatarSprintInput,
    );
    const setCrouchInput = useGameState(
        (state) => state.setGardenAvatarCrouchInput,
    );
    const setZoomInput = useGameState(
        (state) => state.setGardenAvatarZoomInput,
    );
    const requestJump = useGameState((state) => state.requestGardenAvatarJump);

    useEffect(
        () => () => {
            setSprintInput(false);
            setCrouchInput(false);
            setZoomInput(false);
        },
        [setCrouchInput, setSprintInput, setZoomInput],
    );

    const startAction = (
        event: PointerEvent<HTMLButtonElement>,
        setActive: (active: boolean) => void,
    ) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setActive(true);
    };
    const stopAction = (
        event: PointerEvent<HTMLButtonElement>,
        setActive: (active: boolean) => void,
    ) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        setActive(false);
    };

    return (
        <div className="pointer-events-none absolute inset-0 z-30 select-none">
            {!showTouchControls ? (
                <div className="absolute top-[calc(var(--game-safe-area-top,0px)+0.5rem)] left-1/2 hidden -translate-x-1/2 rounded-full border border-border/50 bg-background/75 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm md:block">
                    {boatId
                        ? 'W/S za vožnju · A/D za skretanje · E za izlazak iz barke · Esc za pregled'
                        : 'WASD za hodanje · Shift za trčanje · Ctrl za čučanj · dvaput Space za dvostruki skok · naciljaj barku i klikni za ukrcaj · Esc za izlaz'}
                </div>
            ) : null}

            <div
                aria-hidden="true"
                className={cx(
                    'absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 transition-colors',
                    aimedBoatId && !boatId ? 'text-amber-300' : 'text-white/75',
                )}
            >
                <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-current shadow-sm" />
                <span className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-current shadow-sm" />
            </div>
            {aimedBoatId && !boatId ? (
                <div className="absolute top-[calc(50%+1.25rem)] left-1/2 -translate-x-1/2 rounded-full border border-amber-200/50 bg-neutral-950/70 px-2.5 py-1 text-xs font-medium text-amber-100 shadow-md backdrop-blur-sm">
                    Klikni za ukrcaj
                </div>
            ) : null}

            <div
                className={cx(
                    'absolute left-[calc(var(--game-safe-area-left,0px)+0.5rem)] flex items-center gap-1 rounded-xl border border-border/50 bg-background/70 p-1 shadow-lg backdrop-blur-md',
                    showTouchControls
                        ? 'top-[calc(var(--game-safe-area-top,0px)+0.5rem)]'
                        : 'top-[calc(var(--game-safe-area-top,0px)+0.5rem)] md:top-auto md:bottom-[calc(var(--game-safe-area-bottom,0px)+0.5rem)]',
                )}
            >
                <IconButton
                    title={
                        view === 'first-person'
                            ? 'Prikaži pogled iz trećeg lica'
                            : 'Prikaži pogled iz prvog lica'
                    }
                    variant="plain"
                    className={avatarHudButtonClassName}
                    onClick={() =>
                        setView(
                            view === 'first-person'
                                ? 'third-person'
                                : 'first-person',
                        )
                    }
                >
                    {view === 'first-person' ? (
                        <UserCircle className="size-5" />
                    ) : (
                        <Eye className="size-5" />
                    )}
                </IconButton>
                <IconButton
                    title={boatId ? 'Izađi iz barke' : 'Izađi iz šetnje'}
                    variant="plain"
                    className={avatarHudButtonClassName}
                    onClick={() =>
                        boatId ? setBoatId(null) : setView('overview')
                    }
                >
                    <LogOut className="hidden size-5 sm:block" />
                    <Close className="size-5 sm:hidden" />
                </IconButton>
            </div>

            {showTouchControls ? (
                <>
                    <div className="absolute bottom-[calc(var(--game-safe-area-bottom,0px)+0.75rem)] left-[calc(var(--game-safe-area-left,0px)+0.75rem)]">
                        <GardenAvatarJoystick />
                    </div>

                    {boatId ? (
                        <div className="absolute right-[calc(var(--game-safe-area-right,0px)+0.75rem)] bottom-[calc(var(--game-safe-area-bottom,0px)+0.75rem)]">
                            <IconButton
                                type="button"
                                aria-label="Izađi iz barke"
                                variant="plain"
                                className={avatarTouchActionButtonClassName}
                                onClick={() => setBoatId(null)}
                            >
                                <LogOut aria-hidden="true" className="size-6" />
                            </IconButton>
                        </div>
                    ) : (
                        <div className="absolute right-[calc(var(--game-safe-area-right,0px)+0.75rem)] bottom-[calc(var(--game-safe-area-bottom,0px)+0.75rem)] grid grid-cols-2 gap-2">
                            <IconButton
                                type="button"
                                aria-label="Čučni"
                                variant="plain"
                                className={avatarTouchActionButtonClassName}
                                onPointerDown={(event) =>
                                    startAction(event, setCrouchInput)
                                }
                                onPointerUp={(event) =>
                                    stopAction(event, setCrouchInput)
                                }
                                onPointerCancel={(event) =>
                                    stopAction(event, setCrouchInput)
                                }
                            >
                                <ChevronsDown
                                    aria-hidden="true"
                                    className="size-6"
                                />
                            </IconButton>
                            <IconButton
                                type="button"
                                aria-label="Zum"
                                variant="plain"
                                className={avatarTouchActionButtonClassName}
                                onPointerDown={(event) =>
                                    startAction(event, setZoomInput)
                                }
                                onPointerUp={(event) =>
                                    stopAction(event, setZoomInput)
                                }
                                onPointerCancel={(event) =>
                                    stopAction(event, setZoomInput)
                                }
                            >
                                <ZoomIn aria-hidden="true" className="size-6" />
                            </IconButton>
                            <IconButton
                                type="button"
                                aria-label="Trči"
                                variant="plain"
                                className={avatarTouchActionButtonClassName}
                                onPointerDown={(event) =>
                                    startAction(event, setSprintInput)
                                }
                                onPointerUp={(event) =>
                                    stopAction(event, setSprintInput)
                                }
                                onPointerCancel={(event) =>
                                    stopAction(event, setSprintInput)
                                }
                            >
                                <Footprints
                                    aria-hidden="true"
                                    className="size-6"
                                />
                            </IconButton>
                            <IconButton
                                type="button"
                                aria-label="Skoči"
                                variant="plain"
                                onPointerDown={(event) => {
                                    event.preventDefault();
                                    requestJump();
                                }}
                                className={cx(
                                    avatarTouchActionButtonClassName,
                                    'bg-background/95',
                                )}
                            >
                                <ArrowUp
                                    aria-hidden="true"
                                    className="size-6"
                                />
                            </IconButton>
                        </div>
                    )}
                </>
            ) : null}
        </div>
    );
}
