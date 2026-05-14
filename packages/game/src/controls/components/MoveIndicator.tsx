import { cx } from '@signalco/ui-primitives/cx';

type Direction = 'up' | 'right' | 'down' | 'left';

interface MoveIndicatorProps {
    activeDirection?: Direction;
    onDirectionChange?: (direction: Direction) => void;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function MoveIndicator({
    onDirectionChange: onMove,
    className,
}: MoveIndicatorProps) {
    const handleDirectionClick = (newDirection: Direction) => {
        onMove?.(newDirection);
    };

    return (
        <div
            className={cx(
                //transform: 'rotateX(60deg) rotateZ(45deg)',
                '[transform:rotateX(60deg)_rotateZ(45deg)]',
                'relative pointer-events-none',
                'w-32 h-32',
                className,
            )}
        >
            {/* Center dot */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-green-500 rounded-full"></div>

            {/* Up Arrow */}
            <button
                type="button"
                className={cx(
                    'absolute w-8 h-12 left-1/2 -translate-x-1/2 top-1 transform -translate-y-1/4 transition-all duration-200',
                    'opacity-80 hover:opacity-100',
                )}
                onClick={() => handleDirectionClick('up')}
                aria-label="Move up"
            >
                <svg viewBox="0 0 40 60" className="w-full h-full">
                    <title>Up Arrow</title>
                    <polygon
                        points="20,0 40,30 30,30 30,60 10,60 10,30 0,30"
                        className={cx(
                            'transition-colors duration-200',
                            'fill-slate-600 stroke-slate-500 stroke-1 hover:fill-slate-500',
                        )}
                    />
                </svg>
            </button>

            {/* Right Arrow */}
            <button
                type="button"
                className={cx(
                    'absolute w-12 h-8 right-1 top-1/2 -translate-y-1/2 transform translate-x-1/4 transition-all duration-200',
                    'opacity-80 hover:opacity-100',
                )}
                onClick={() => handleDirectionClick('right')}
                aria-label="Move right"
            >
                <svg viewBox="0 0 60 40" className="w-full h-full">
                    <title>Right Arrow</title>
                    <polygon
                        points="60,20 30,40 30,30 0,30 0,10 30,10 30,0"
                        className={cx(
                            'transition-colors duration-200',
                            'fill-slate-600 stroke-slate-500 stroke-1 hover:fill-slate-500',
                        )}
                    />
                </svg>
            </button>

            {/* Down Arrow */}
            <button
                type="button"
                className={cx(
                    'absolute w-8 h-12 left-1/2 -translate-x-1/2 bottom-1 transform translate-y-1/4 transition-all duration-200',
                    'opacity-80 hover:opacity-100',
                )}
                onClick={() => handleDirectionClick('down')}
                aria-label="Move down"
            >
                <svg viewBox="0 0 40 60" className="w-full h-full">
                    <title>Down Arrow</title>
                    <polygon
                        points="20,60 0,30 10,30 10,0 30,0 30,30 40,30"
                        className={cx(
                            'transition-colors duration-200',
                            'fill-slate-600 stroke-slate-500 stroke-1 hover:fill-slate-500',
                        )}
                    />
                </svg>
            </button>

            {/* Left Arrow */}
            <button
                type="button"
                className={cx(
                    'absolute w-12 h-8 left-1 top-1/2 -translate-y-1/2 transform -translate-x-1/4 transition-all duration-200',
                    'opacity-80 hover:opacity-100',
                )}
                onClick={() => handleDirectionClick('left')}
                aria-label="Move left"
            >
                <svg viewBox="0 0 60 40" className="w-full h-full">
                    <title>Left Arrow</title>
                    <polygon
                        points="0,20 30,0 30,10 60,10 60,30 30,30 30,40"
                        className={cx(
                            'transition-colors duration-200',
                            'fill-slate-600 stroke-slate-500 stroke-1 hover:fill-slate-500',
                        )}
                    />
                </svg>
            </button>
        </div>
    );
}
