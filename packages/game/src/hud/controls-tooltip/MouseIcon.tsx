export type MouseIconProps = { wheelOffset?: number };

export function MouseIcon({ wheelOffset = 0 }: MouseIconProps) {
    return (
        <svg
            viewBox="0 0 20 28"
            className="h-6 w-4 fill-none stroke-muted-foreground/60"
            strokeWidth="1.5"
            aria-hidden="true"
        >
            <rect x="2" y="2" width="16" height="24" rx="8" />
            <rect
                x="7"
                y={7 + wheelOffset}
                width="6"
                height="5"
                rx="3"
                className="fill-muted-foreground/30"
            />
            <line x1="10" y1="13" x2="10" y2="2" />
        </svg>
    );
}
