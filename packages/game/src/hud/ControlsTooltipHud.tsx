'use client';

import { Close, Info } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'game-controls-tooltip-v1';
const TOOLTIP_VERSION = 2;
const REMINDER_AFTER_MS = 1000 * 60 * 60 * 24 * 30;
const TWO_PI = Math.PI * 2;

type DeviceType = 'desktop' | 'tablet' | 'mobile';

type TooltipState = { dismissedAt: number; seenVersion: number };
type CubeOptions = {
    translateX?: number;
    scale?: number;
    rotateY?: number;
    size?: number;
};
type CubeVertex = { x: number; y: number; z: number };
type RotateDirection = 'cw' | 'ccw';
type PanKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

const cubeVertices: CubeVertex[] = [
    { x: -1, y: -1, z: -1 },
    { x: 1, y: -1, z: -1 },
    { x: 1, y: 1, z: -1 },
    { x: -1, y: 1, z: -1 },
    { x: -1, y: -1, z: 1 },
    { x: 1, y: -1, z: 1 },
    { x: 1, y: 1, z: 1 },
    { x: -1, y: 1, z: 1 },
];

const cubeEdges: [number, number][] = [
    [0, 1],
    [1, 5],
    [5, 4],
    [4, 0],
    [3, 2],
    [2, 6],
    [6, 7],
    [7, 3],
    [0, 3],
    [1, 2],
    [5, 6],
    [4, 7],
];

function getDeviceType(): DeviceType {
    if (typeof window === 'undefined') return 'desktop';
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
}

function readStorage(): Partial<Record<DeviceType, TooltipState>> {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        return typeof parsed === 'object' && parsed
            ? (parsed as Partial<Record<DeviceType, TooltipState>>)
            : {};
    } catch {
        return {};
    }
}

function writeStorage(next: Partial<Record<DeviceType, TooltipState>>) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function shouldShowTooltip(record: TooltipState | undefined) {
    return (
        !record ||
        record.seenVersion !== TOOLTIP_VERSION ||
        Date.now() - record.dismissedAt > REMINDER_AFTER_MS
    );
}

function prefersReducedMotion() {
    return (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

function getAccessibleControlDescription(deviceType: DeviceType) {
    if (deviceType === 'desktop') {
        return 'Pomak kamere: povucite mišem ili koristite strelice. Zum: kotačić miša. Rotacija vrta: tipke Q i W ili tipke za rotaciju.';
    }

    return 'Pomak kamere: povucite jednim prstom. Zum: stisnite ili raširite dva prsta. Rotacija vrta: koristite tipke za rotaciju dolje lijevo.';
}

function getActivePanKey(phase: number): PanKey {
    const x = Math.sin(phase);
    const y = Math.cos(phase);

    if (Math.abs(x) > Math.abs(y)) {
        return x > 0 ? 'ArrowRight' : 'ArrowLeft';
    }

    return y > 0 ? 'ArrowUp' : 'ArrowDown';
}

function projectCubeVertex(vertex: CubeVertex, angleRad: number) {
    const cubeSize = 30;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const rx = vertex.x * cosA - vertex.z * sinA;
    const rz = vertex.x * sinA + vertex.z * cosA;
    const isoAngle = Math.PI / 6;

    return {
        x: (rx - rz) * Math.cos(isoAngle) * cubeSize + 50,
        y:
            -(vertex.y * cubeSize) +
            (rx + rz) * Math.sin(isoAngle) * cubeSize +
            50,
    };
}

function getCubeEdgeOpacity(
    firstVertex: CubeVertex,
    secondVertex: CubeVertex,
    angleRad: number,
) {
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const getDepth = (vertex: CubeVertex) =>
        vertex.x * sinA + vertex.z * cosA + (vertex.x * cosA - vertex.z * sinA);
    const averageDepth = (getDepth(firstVertex) + getDepth(secondVertex)) / 2;
    const normalized = (averageDepth + 2.8) / 5.6;
    const clamped = Math.max(0, Math.min(1, normalized));

    return 0.18 + clamped * 0.55;
}

function renderWireframeCube({
    translateX = 0,
    scale = 1,
    rotateY = 0,
    size = 42,
}: CubeOptions) {
    const angleRad = (rotateY * Math.PI) / 180;
    const projected = cubeVertices.map((vertex) =>
        projectCubeVertex(vertex, angleRad),
    );

    return (
        <div
            className="flex items-center justify-center"
            style={{
                width: size,
                height: size,
                transform: `translateX(${translateX}px) scale(${scale})`,
                transition: 'transform 120ms linear',
            }}
        >
            <svg
                viewBox="0 0 100 100"
                className="h-full w-full overflow-visible"
                aria-hidden="true"
            >
                {cubeEdges.map(([firstIndex, secondIndex]) => {
                    const firstVertex = cubeVertices[firstIndex];
                    const secondVertex = cubeVertices[secondIndex];
                    const opacity = getCubeEdgeOpacity(
                        firstVertex,
                        secondVertex,
                        angleRad,
                    );

                    return (
                        <line
                            key={`${firstIndex}-${secondIndex}`}
                            x1={projected[firstIndex].x}
                            y1={projected[firstIndex].y}
                            x2={projected[secondIndex].x}
                            y2={projected[secondIndex].y}
                            className="stroke-muted-foreground"
                            style={{ opacity }}
                            strokeWidth={1.5}
                            strokeLinecap="round"
                        />
                    );
                })}
            </svg>
        </div>
    );
}

function renderTouchIndicator(touchX: number, touchY = 0) {
    return (
        <div className="relative flex h-8 w-16 items-center justify-center">
            <div className="absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-muted-foreground/25 to-transparent" />
            <div className="absolute bottom-2 top-2 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-muted-foreground/20 to-transparent" />
            <div
                className="absolute flex size-5 items-center justify-center"
                style={{
                    transform: `translate(${touchX}px, ${touchY}px)`,
                    transition: 'transform 80ms linear',
                }}
            >
                <div className="absolute size-full animate-ping rounded-full bg-muted-foreground/20" />
                <div className="size-3 rounded-full border border-muted-foreground/30 bg-muted-foreground/60" />
            </div>
        </div>
    );
}

function renderMouseIcon(wheelOffset = 0) {
    return (
        <svg
            viewBox="0 0 20 28"
            className="h-6 w-4 fill-none stroke-muted-foreground/60"
            strokeWidth="1.5"
            aria-hidden="true"
        >
            <rect x="2" y="2" width="16" height="24" rx="8" />
            <rect
                x="7"
                y={7 + wheelOffset}
                width="6"
                height="5"
                rx="3"
                className="fill-muted-foreground/30"
            />
            <line x1="10" y1="13" x2="10" y2="2" />
        </svg>
    );
}

function renderArrowKey(keyName: PanKey, activeKey: PanKey) {
    const pointsByKey: Record<PanKey, string> = {
        ArrowUp: '4,1 7,6 1,6',
        ArrowDown: '4,7 7,2 1,2',
        ArrowLeft: '1,4 6,1 6,7',
        ArrowRight: '7,4 2,1 2,7',
    };
    const isActive = keyName === activeKey;

    return (
        <div
            key={keyName}
            className={`flex size-4 items-center justify-center rounded border transition-colors duration-100 ${
                isActive
                    ? 'border-muted-foreground/50 bg-muted-foreground/15 text-muted-foreground'
                    : 'border-muted-foreground/20 text-muted-foreground/45'
            }`}
        >
            <svg
                viewBox="0 0 8 8"
                className="size-2 fill-current"
                aria-hidden="true"
            >
                <polygon points={pointsByKey[keyName]} />
            </svg>
        </div>
    );
}

function renderDesktopMoveControls(activeKey: PanKey) {
    return (
        <div className="flex items-center gap-2">
            {renderMouseIcon()}
            <div className="h-5 w-px bg-border" />
            <div className="grid grid-cols-3 gap-0.5">
                <div />
                {renderArrowKey('ArrowUp', activeKey)}
                <div />
                {renderArrowKey('ArrowLeft', activeKey)}
                {renderArrowKey('ArrowDown', activeKey)}
                {renderArrowKey('ArrowRight', activeKey)}
            </div>
        </div>
    );
}

function renderPinchGesture(spread: number) {
    const touchDistance = 4 + spread * 12;
    const isOpening = spread > 0.5;

    return (
        <div className="relative flex h-8 w-16 items-center justify-center">
            <svg
                viewBox="0 0 36 12"
                className="absolute h-3 w-9 stroke-muted-foreground/35"
                strokeWidth="1.2"
                fill="none"
                aria-hidden="true"
            >
                {isOpening ? (
                    <>
                        <line x1="16" y1="6" x2="5" y2="6" />
                        <polyline points="9,3 5,6 9,9" />
                        <line x1="20" y1="6" x2="31" y2="6" />
                        <polyline points="27,3 31,6 27,9" />
                    </>
                ) : (
                    <>
                        <line x1="5" y1="6" x2="15" y2="6" />
                        <polyline points="11,3 15,6 11,9" />
                        <line x1="31" y1="6" x2="21" y2="6" />
                        <polyline points="25,3 21,6 25,9" />
                    </>
                )}
            </svg>
            {[-touchDistance, touchDistance].map((offset) => (
                <div
                    key={offset > 0 ? 'right' : 'left'}
                    className="absolute flex size-4 items-center justify-center"
                    style={{
                        transform: `translateX(${offset}px)`,
                        transition: 'transform 80ms linear',
                    }}
                >
                    <div className="absolute size-full animate-ping rounded-full bg-muted-foreground/20" />
                    <div className="size-2.5 rounded-full border border-muted-foreground/30 bg-muted-foreground/60" />
                </div>
            ))}
        </div>
    );
}

function renderScrollWheelIndicator(isZoomingIn: boolean, progress: number) {
    return (
        <div className="flex items-center gap-2">
            <div className="relative">
                {renderMouseIcon((progress - 0.5) * 4)}
                <svg
                    viewBox="0 0 8 16"
                    className="absolute -right-2 top-1/2 h-4 w-2 -translate-y-1/2 stroke-muted-foreground/45"
                    strokeWidth="1.5"
                    fill="none"
                    aria-hidden="true"
                >
                    <polyline
                        points="1,5 4,1 7,5"
                        className={
                            isZoomingIn
                                ? 'opacity-100'
                                : 'opacity-30 transition-opacity'
                        }
                    />
                    <polyline
                        points="1,11 4,15 7,11"
                        className={
                            isZoomingIn
                                ? 'opacity-30 transition-opacity'
                                : 'opacity-100'
                        }
                    />
                </svg>
            </div>
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground/55">
                <span className={isZoomingIn ? 'opacity-40' : 'opacity-100'}>
                    -
                </span>
                <div className="h-1 w-6 overflow-hidden rounded bg-muted-foreground/15">
                    <div
                        className="h-full rounded bg-muted-foreground/45 transition-all duration-100"
                        style={{ width: `${progress * 100}%` }}
                    />
                </div>
                <span className={isZoomingIn ? 'opacity-100' : 'opacity-40'}>
                    +
                </span>
            </div>
        </div>
    );
}

function renderRotateButton(
    direction: RotateDirection,
    activeDirection: RotateDirection,
    keyLabel?: string,
) {
    const isClockwise = direction === 'cw';
    const isActive = direction === activeDirection;

    return (
        <div key={direction} className="flex flex-col items-center gap-0.5">
            <div
                className={`flex size-7 items-center justify-center rounded border transition-colors duration-100 ${
                    isActive
                        ? 'border-muted-foreground/50 bg-muted-foreground/15'
                        : 'border-muted-foreground/20'
                }`}
            >
                <svg
                    viewBox="0 0 20 20"
                    className="size-3.5 stroke-muted-foreground/70"
                    strokeWidth="1.5"
                    fill="none"
                    aria-hidden="true"
                >
                    <path
                        d={
                            isClockwise
                                ? 'M17,10 A7,7 0 1,0 10,17'
                                : 'M3,10 A7,7 0 1,1 10,17'
                        }
                        strokeLinecap="round"
                    />
                    <polyline
                        points={
                            isClockwise ? '17,5 17,10 12,10' : '3,5 3,10 8,10'
                        }
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>
            {keyLabel && (
                <span className="font-mono text-[8px] text-muted-foreground/45">
                    {keyLabel}
                </span>
            )}
        </div>
    );
}

function renderRotateControls(
    activeDirection: RotateDirection,
    showKeyHints: boolean,
) {
    return (
        <div className="flex items-center gap-1.5">
            {renderRotateButton('cw', activeDirection, showKeyHints ? 'Q' : '')}
            {renderRotateButton(
                'ccw',
                activeDirection,
                showKeyHints ? 'W' : '',
            )}
        </div>
    );
}

function renderVisualizationSection(
    title: string,
    label: string,
    cube: ReactNode,
    controls: ReactNode,
    withDivider = false,
) {
    return (
        <div
            className={`min-w-0 px-2 py-2 ${
                withDivider ? 'border-l border-border/70' : ''
            }`}
        >
            <div className="flex h-14 items-center justify-center">{cube}</div>
            <div className="mt-2 flex h-10 items-center justify-center rounded-md bg-muted/40">
                {controls}
            </div>
            <p className="mt-1.5 truncate text-center text-[11px] font-semibold leading-tight text-foreground">
                {title}
            </p>
            <p className="truncate text-center text-[10px] leading-tight text-muted-foreground">
                {label}
            </p>
        </div>
    );
}

function renderControlsVisualization(deviceType: DeviceType, phase: number) {
    const isTouchDevice = deviceType !== 'desktop';
    const moveX = Math.sin(phase) * 14;
    const moveY = Math.cos(phase) * 5;
    const zoomProgress = Math.sin(phase * 0.9 + 0.6) * 0.5 + 0.5;
    const rotatePhase = phase * 0.8;
    const activeRotation: RotateDirection =
        Math.cos(rotatePhase) > 0 ? 'cw' : 'ccw';

    return (
        <>
            <p className="sr-only">
                {getAccessibleControlDescription(deviceType)}
            </p>
            <div
                className="mt-3 grid grid-cols-3 overflow-hidden rounded-md bg-background/60"
                aria-hidden="true"
            >
                {renderVisualizationSection(
                    'Pomak',
                    isTouchDevice ? 'Povuci' : 'Strelice',
                    renderWireframeCube({ translateX: moveX }),
                    isTouchDevice
                        ? renderTouchIndicator(moveX * 0.75, moveY)
                        : renderDesktopMoveControls(getActivePanKey(phase)),
                )}
                {renderVisualizationSection(
                    'Zum',
                    isTouchDevice ? 'Stisni' : 'Kotačić',
                    renderWireframeCube({
                        scale: 0.78 + zoomProgress * 0.42,
                    }),
                    isTouchDevice
                        ? renderPinchGesture(zoomProgress)
                        : renderScrollWheelIndicator(
                              zoomProgress > 0.5,
                              zoomProgress,
                          ),
                    true,
                )}
                {renderVisualizationSection(
                    'Rotacija',
                    isTouchDevice ? 'Tipke' : 'Q / W',
                    renderWireframeCube({
                        rotateY: Math.sin(rotatePhase) * 70,
                    }),
                    renderRotateControls(activeRotation, !isTouchDevice),
                    true,
                )}
            </div>
        </>
    );
}

export function ControlsTooltipHud() {
    const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
    const [isReminder, setIsReminder] = useState(false);
    const [open, setOpen] = useState(false);
    const [phase, setPhase] = useState(0.75);

    useEffect(() => {
        const syncDeviceType = () => {
            const nextType = getDeviceType();
            setDeviceType(nextType);
            const record = readStorage()[nextType];
            setIsReminder(record?.seenVersion === TOOLTIP_VERSION);
            if (shouldShowTooltip(record)) {
                setOpen(true);
            }
        };

        syncDeviceType();
        window.addEventListener('resize', syncDeviceType);
        return () => window.removeEventListener('resize', syncDeviceType);
    }, []);

    useEffect(() => {
        if (!open || prefersReducedMotion()) return;

        const interval = window.setInterval(() => {
            setPhase((current) => (current + 0.12) % TWO_PI);
        }, 50);

        return () => window.clearInterval(interval);
    }, [open]);

    const dismiss = () => {
        setOpen(false);
        const map = readStorage();
        map[deviceType] = {
            dismissedAt: Date.now(),
            seenVersion: TOOLTIP_VERSION,
        };
        writeStorage(map);
        setIsReminder(true);
    };

    if (!open) {
        return (
            <div className="pointer-events-auto">
                <IconButton
                    title="Prikaži kontrole"
                    variant="plain"
                    onClick={() => setOpen(true)}
                    className="hover:bg-muted"
                >
                    <Info className="size-5" />
                </IconButton>
            </div>
        );
    }

    return (
        <div className="pointer-events-auto max-w-[calc(100vw-1rem)] rounded-lg border bg-card/95 p-3 shadow-md backdrop-blur-sm sm:max-w-sm">
            <div className="flex items-start justify-between gap-2">
                <Typography level="body2" className="font-semibold">
                    {isReminder ? 'Podsjetnik: kontrole' : 'Kontrole igre'}
                </Typography>
                <IconButton
                    title="Zatvori"
                    variant="plain"
                    onClick={dismiss}
                    className="-mr-2 -mt-2"
                >
                    <Close className="size-4" />
                </IconButton>
            </div>
            {renderControlsVisualization(deviceType, phase)}
            <Button
                variant="solid"
                size="sm"
                className="mt-3 w-full"
                onClick={dismiss}
            >
                Razumijem
            </Button>
        </div>
    );
}
