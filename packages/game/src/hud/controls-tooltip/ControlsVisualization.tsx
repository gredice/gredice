import { DesktopMoveControls } from './DesktopMoveControls';
import { MouseIcon } from './MouseIcon';
import { PinchGesture } from './PinchGesture';
import { RotateControls } from './RotateControls';
import { ScrollWheelIndicator } from './ScrollWheelIndicator';
import { TouchIndicator } from './TouchIndicator';
import type { DeviceType, RotateDirection } from './types';
import { VisualizationSection } from './VisualizationSection';
import { WireframeCube } from './WireframeCube';

export type ControlsVisualizationProps = {
    deviceType: DeviceType;
    phase: number;
};

function getActivePanKey(phase: number) {
    const x = Math.sin(phase);
    const y = Math.cos(phase);

    if (Math.abs(x) > Math.abs(y)) {
        return x > 0 ? ('ArrowRight' as const) : ('ArrowLeft' as const);
    }

    return y > 0 ? ('ArrowUp' as const) : ('ArrowDown' as const);
}

function getAccessibleDescription(deviceType: DeviceType) {
    if (deviceType === 'desktop') {
        return 'Pomak kamere: povucite mišem ili koristite strelice. Zum: kotačić miša. Rotacija vrta: tipke Q i W ili tipke za rotaciju. Pokupi i spusti blok: drži klik na bloku, povuci ga i pusti. Rotacija bloka: dvaput klikni blok.';
    }

    return 'Pomak kamere: povucite jednim prstom. Zum: stisnite ili raširite dva prsta. Rotacija vrta: koristite tipke za rotaciju dolje lijevo. Pokupi i spusti blok: drži prst na bloku, povuci ga i pusti. Rotacija bloka: dvaput dodirni blok.';
}

function PickupDropControls({ isTouchDevice }: { isTouchDevice: boolean }) {
    return (
        <div className="flex items-center gap-2">
            {isTouchDevice ? <TouchIndicator touchX={0} /> : <MouseIcon />}
            <div className="h-5 w-px bg-border" />
            <div className="h-1.5 w-8 overflow-hidden rounded-full bg-muted-foreground/15">
                <div className="h-full w-2/3 rounded-full bg-muted-foreground/50" />
            </div>
        </div>
    );
}

function DoubleTapControls({ isTouchDevice }: { isTouchDevice: boolean }) {
    return (
        <div className="flex items-center gap-1.5">
            {isTouchDevice ? (
                <div className="relative flex h-8 w-14 items-center justify-center">
                    <div className="absolute left-4 flex size-4 items-center justify-center">
                        <div className="absolute size-full rounded-full bg-muted-foreground/15" />
                        <div className="size-2 rounded-full bg-muted-foreground/55" />
                    </div>
                    <div className="absolute right-4 flex size-5 items-center justify-center">
                        <div className="absolute size-full animate-ping rounded-full bg-muted-foreground/20" />
                        <div className="size-2.5 rounded-full bg-muted-foreground/65" />
                    </div>
                </div>
            ) : (
                <>
                    <MouseIcon />
                    <span className="text-[10px] font-bold text-muted-foreground/70">
                        x2
                    </span>
                </>
            )}
        </div>
    );
}

export function ControlsVisualization({
    deviceType,
    phase,
}: ControlsVisualizationProps) {
    const isTouchDevice = deviceType !== 'desktop';
    const moveX = Math.sin(phase) * 14;
    const moveY = Math.cos(phase) * 5;
    const zoomProgress = Math.sin(phase * 0.9 + 0.6) * 0.5 + 0.5;
    const rotatePhase = phase * 0.8;
    const pickupProgress = Math.sin(phase * 1.1) * 0.5 + 0.5;
    const activeRotation: RotateDirection =
        Math.cos(rotatePhase) > 0 ? 'cw' : 'ccw';

    return (
        <>
            <p className="sr-only">{getAccessibleDescription(deviceType)}</p>
            <div
                className="grid grid-cols-2 overflow-hidden rounded-md bg-card border-b-4 border border-tertiary sm:grid-cols-5"
                aria-hidden="true"
            >
                <VisualizationSection
                    title="Pomak"
                    label={isTouchDevice ? 'Povuci' : 'Strelice'}
                    cube={<WireframeCube translateX={moveX} />}
                    controls={
                        isTouchDevice ? (
                            <TouchIndicator
                                touchX={moveX * 0.75}
                                touchY={moveY}
                            />
                        ) : (
                            <DesktopMoveControls
                                activeKey={getActivePanKey(phase)}
                            />
                        )
                    }
                />
                <VisualizationSection
                    title="Zumiranje"
                    label={isTouchDevice ? 'Stisni' : 'Kotačić'}
                    cube={<WireframeCube scale={0.78 + zoomProgress * 0.42} />}
                    controls={
                        isTouchDevice ? (
                            <PinchGesture spread={zoomProgress} />
                        ) : (
                            <ScrollWheelIndicator
                                isZoomingIn={zoomProgress > 0.5}
                                progress={zoomProgress}
                            />
                        )
                    }
                    withDivider
                />
                <VisualizationSection
                    title="Rotacija vrta"
                    label={isTouchDevice ? 'Tipke' : 'Q / W'}
                    cube={
                        <WireframeCube rotateY={Math.sin(rotatePhase) * 70} />
                    }
                    controls={
                        <RotateControls
                            activeDirection={activeRotation}
                            showKeyHints={!isTouchDevice}
                        />
                    }
                    withDivider
                />
                <VisualizationSection
                    title="Pokupi / spusti"
                    label="Drži i pusti"
                    cube={
                        <WireframeCube
                            translateY={-2 - pickupProgress * 9}
                            scale={1 + pickupProgress * 0.08}
                        />
                    }
                    controls={
                        <PickupDropControls isTouchDevice={isTouchDevice} />
                    }
                    withDivider
                />
                <VisualizationSection
                    title="Okreni blok"
                    label={isTouchDevice ? 'Dvaput dodirni' : 'Dvaput klikni'}
                    cube={
                        <WireframeCube rotateY={Math.sin(phase * 1.35) * 55} />
                    }
                    controls={
                        <DoubleTapControls isTouchDevice={isTouchDevice} />
                    }
                    withDivider
                />
            </div>
        </>
    );
}
