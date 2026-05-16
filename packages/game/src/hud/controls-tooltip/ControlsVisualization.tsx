import { DesktopMoveControls } from './DesktopMoveControls';
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
    isEditMode?: boolean;
};

function getActivePanKey(phase: number) {
    const x = Math.sin(phase);
    const y = Math.cos(phase);

    if (Math.abs(x) > Math.abs(y)) {
        return x > 0 ? ('ArrowRight' as const) : ('ArrowLeft' as const);
    }

    return y > 0 ? ('ArrowUp' as const) : ('ArrowDown' as const);
}

function getAccessibleDescription(deviceType: DeviceType, isEditMode: boolean) {
    if (deviceType === 'desktop') {
        if (isEditMode) {
            return 'Pomak kamere: povucite desnom tipkom miša ili koristite strelice. Zum: kotačić miša. Rotacija vrta: tipke Q i W ili tipke za rotaciju.';
        }
        return 'Pomak kamere: povucite mišem ili koristite strelice. Zum: kotačić miša. Rotacija vrta: tipke Q i W ili tipke za rotaciju.';
    }

    return 'Pomak kamere: povucite jednim prstom. Zum: stisnite ili raširite dva prsta. Rotacija vrta: koristite tipke za rotaciju dolje lijevo.';
}

export function ControlsVisualization({
    deviceType,
    phase,
    isEditMode = false,
}: ControlsVisualizationProps) {
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
                {getAccessibleDescription(deviceType, isEditMode)}
            </p>
            <div
                className="grid grid-cols-3 overflow-hidden rounded-md bg-card border-b-4 border border-tertiary"
                aria-hidden="true"
            >
                <VisualizationSection
                    title="Pomak"
                    label={
                        isTouchDevice
                            ? 'Povuci'
                            : isEditMode
                              ? 'Desni klik'
                              : 'Strelice'
                    }
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
                    title="Rotacija"
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
            </div>
        </>
    );
}
