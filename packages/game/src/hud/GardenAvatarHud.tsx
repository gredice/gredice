'use client';

import { IconButton } from '@gredice/ui/IconButton';
import {
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    Camera,
    Close,
    LogOut,
    UserCircle,
} from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import type { PointerEvent } from 'react';
import { useGameState } from '../useGameState';

const avatarHudButtonClassName =
    'pointer-events-auto border border-border/60 bg-background/85 shadow-lg backdrop-blur-md hover:bg-muted active:scale-95 touch-none';

export function GardenAvatarHud() {
    const view = useGameState((state) => state.gardenAvatarView);
    const setView = useGameState((state) => state.setGardenAvatarView);
    const setMoveInput = useGameState(
        (state) => state.setGardenAvatarMoveInput,
    );
    const requestJump = useGameState((state) => state.requestGardenAvatarJump);

    const startMove = (
        event: PointerEvent<HTMLButtonElement>,
        input: { forward: number; right: number },
    ) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setMoveInput(input);
    };
    const stopMove = (event: PointerEvent<HTMLButtonElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        setMoveInput({ forward: 0, right: 0 });
    };

    return (
        <div className="pointer-events-none absolute inset-0 z-30 select-none">
            <div className="absolute top-[calc(var(--game-safe-area-top,0px)+0.5rem)] left-1/2 hidden -translate-x-1/2 rounded-full border border-border/50 bg-background/75 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm md:block">
                WASD za hodanje · Shift za trčanje · Ctrl za čučanj · Space za
                skok · klik za pogled mišem · Esc za izlaz
            </div>

            <div className="absolute bottom-[calc(var(--game-safe-area-bottom,0px)+0.5rem)] left-[calc(var(--game-safe-area-left,0px)+0.5rem)] flex items-center gap-1 rounded-xl border border-border/50 bg-background/70 p-1 shadow-lg backdrop-blur-md">
                <IconButton
                    title={
                        view === 'first-person'
                            ? 'Prikaži pogled iz trećeg lica'
                            : 'Prikaži POV pogled'
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
                        <Camera className="size-5" />
                    )}
                </IconButton>
                <IconButton
                    title="Izađi iz šetnje"
                    variant="plain"
                    className={avatarHudButtonClassName}
                    onClick={() => setView('overview')}
                >
                    <LogOut className="hidden size-5 sm:block" />
                    <Close className="size-5 sm:hidden" />
                </IconButton>
            </div>

            <div className="absolute bottom-[calc(var(--game-safe-area-bottom,0px)+0.5rem)] left-1/2 grid -translate-x-1/2 grid-cols-3 grid-rows-2 gap-1 md:hidden">
                <IconButton
                    title="Hodaj naprijed"
                    variant="plain"
                    className={cx(
                        avatarHudButtonClassName,
                        'col-start-2 row-start-1 size-12',
                    )}
                    onPointerDown={(event) =>
                        startMove(event, { forward: 1, right: 0 })
                    }
                    onPointerUp={stopMove}
                    onPointerCancel={stopMove}
                >
                    <ArrowUp className="size-6" />
                </IconButton>
                <IconButton
                    title="Hodaj lijevo"
                    variant="plain"
                    className={cx(
                        avatarHudButtonClassName,
                        'col-start-1 row-start-2 size-12',
                    )}
                    onPointerDown={(event) =>
                        startMove(event, { forward: 0, right: -1 })
                    }
                    onPointerUp={stopMove}
                    onPointerCancel={stopMove}
                >
                    <ArrowLeft className="size-6" />
                </IconButton>
                <IconButton
                    title="Hodaj natrag"
                    variant="plain"
                    className={cx(
                        avatarHudButtonClassName,
                        'col-start-2 row-start-2 size-12',
                    )}
                    onPointerDown={(event) =>
                        startMove(event, { forward: -1, right: 0 })
                    }
                    onPointerUp={stopMove}
                    onPointerCancel={stopMove}
                >
                    <ArrowDown className="size-6" />
                </IconButton>
                <IconButton
                    title="Hodaj desno"
                    variant="plain"
                    className={cx(
                        avatarHudButtonClassName,
                        'col-start-3 row-start-2 size-12',
                    )}
                    onPointerDown={(event) =>
                        startMove(event, { forward: 0, right: 1 })
                    }
                    onPointerUp={stopMove}
                    onPointerCancel={stopMove}
                >
                    <ArrowRight className="size-6" />
                </IconButton>
            </div>

            <button
                type="button"
                onPointerDown={(event) => {
                    event.preventDefault();
                    requestJump();
                }}
                className="pointer-events-auto absolute right-[calc(var(--game-safe-area-right,0px)+0.75rem)] bottom-[calc(var(--game-safe-area-bottom,0px)+0.75rem)] flex size-14 touch-none items-center justify-center rounded-full border border-border/60 bg-background/85 text-sm font-semibold shadow-lg backdrop-blur-md transition-transform active:scale-95 md:hidden"
                aria-label="Skoči"
            >
                Skoči
            </button>
        </div>
    );
}
