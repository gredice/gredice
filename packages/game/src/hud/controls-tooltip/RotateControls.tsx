import { RotateButton } from './RotateButton';
import type { RotateDirection } from './types';

export type RotateControlsProps = {
    activeDirection: RotateDirection;
    showKeyHints: boolean;
};

export function RotateControls({
    activeDirection,
    showKeyHints,
}: RotateControlsProps) {
    return (
        <div className="flex items-center gap-1.5">
            <RotateButton
                direction="cw"
                activeDirection={activeDirection}
                keyLabel={showKeyHints ? 'Q' : ''}
            />
            <RotateButton
                direction="ccw"
                activeDirection={activeDirection}
                keyLabel={showKeyHints ? 'W' : ''}
            />
        </div>
    );
}
