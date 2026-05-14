import { MouseIcon } from './MouseIcon';

export type ScrollWheelIndicatorProps = {
    isZoomingIn: boolean;
    progress: number;
};

export function ScrollWheelIndicator({
    isZoomingIn,
    progress,
}: ScrollWheelIndicatorProps) {
    return (
        <div className="flex items-center gap-2">
            <div className="relative">
                <MouseIcon wheelOffset={(progress - 0.5) * 4} />
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
