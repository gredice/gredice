import { Edges, Outlines } from '@react-three/drei';

type HoverOutlineProps = {
    hovered?: boolean;
    variant?: 'edges' | 'outlines';
    color?: string;
    backingColor?: string;
    thickness?: number;
};

export function HoverOutline({
    hovered,
    variant,
    color = 'white',
    backingColor,
    thickness = 5,
}: HoverOutlineProps) {
    if (!hovered) return null;
    if (variant === 'outlines') {
        return (
            <>
                {backingColor && (
                    <Outlines thickness={thickness + 3} color={backingColor} />
                )}
                <Outlines thickness={thickness} color={color} />
            </>
        );
    }

    return (
        <Edges
            linewidth={thickness}
            threshold={60} // Display edges only when the angle between two faces exceeds this value (default=15 degrees)
            color={color}
        />
    );
}
