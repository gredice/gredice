export type TouchIndicatorProps = { touchX: number; touchY?: number };

export function TouchIndicator({ touchX, touchY = 0 }: TouchIndicatorProps) {
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
