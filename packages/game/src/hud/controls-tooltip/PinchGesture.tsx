export type PinchGestureProps = { spread: number };

export function PinchGesture({ spread }: PinchGestureProps) {
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
