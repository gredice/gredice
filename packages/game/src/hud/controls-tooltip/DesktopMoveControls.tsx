import { ArrowKey } from './ArrowKey';
import { MouseIcon } from './MouseIcon';
import type { PanKey } from './types';

export type DesktopMoveControlsProps = { activeKey: PanKey };

export function DesktopMoveControls({ activeKey }: DesktopMoveControlsProps) {
    return (
        <div className="flex items-center gap-2">
            <MouseIcon />
            <div className="h-5 w-px bg-border" />
            <div className="grid grid-cols-3 gap-0.5">
                <div />
                <ArrowKey keyName="ArrowUp" activeKey={activeKey} />
                <div />
                <ArrowKey keyName="ArrowLeft" activeKey={activeKey} />
                <ArrowKey keyName="ArrowDown" activeKey={activeKey} />
                <ArrowKey keyName="ArrowRight" activeKey={activeKey} />
            </div>
        </div>
    );
}
