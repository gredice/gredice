import type { PanKey } from './types';

export type ArrowKeyProps = { keyName: PanKey; activeKey: PanKey };

const pointsByKey: Record<PanKey, string> = {
    ArrowUp: '4,1 7,6 1,6',
    ArrowDown: '4,7 7,2 1,2',
    ArrowLeft: '1,4 6,1 6,7',
    ArrowRight: '7,4 2,1 2,7',
};

export function ArrowKey({ keyName, activeKey }: ArrowKeyProps) {
    const isActive = keyName === activeKey;

    return (
        <div
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
