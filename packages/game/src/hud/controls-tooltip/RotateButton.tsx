import { Redo, Undo } from '@signalco/ui-icons';
import type { RotateDirection } from './types';

export type RotateButtonProps = {
    direction: RotateDirection;
    activeDirection: RotateDirection;
    keyLabel?: string;
};

export function RotateButton({
    direction,
    activeDirection,
    keyLabel,
}: RotateButtonProps) {
    const isClockwise = direction === 'cw';
    const isActive = direction === activeDirection;
    const Icon = isClockwise ? Redo : Undo;

    return (
        <div className="flex flex-col items-center gap-0.5">
            <div
                className={`flex size-7 items-center justify-center rounded border transition-colors duration-100 ${
                    isActive
                        ? 'border-muted-foreground/50 bg-muted-foreground/15 text-muted-foreground/70'
                        : 'border-muted-foreground/20 text-muted-foreground/35'
                }`}
            >
                <Icon className="size-3.5" aria-hidden="true" />
            </div>
            {keyLabel && (
                <span className="font-mono text-[8px] text-muted-foreground/45">
                    {keyLabel}
                </span>
            )}
        </div>
    );
}
