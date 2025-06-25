import { Edges, Outlines } from "@react-three/drei";

export function HoverOutline({ hovered, variant }: { hovered?: boolean, variant?: 'edges' | 'outlines' }) {
    if (!hovered) return null;
    if (variant === 'outlines') {
        return (
            <Outlines thickness={5} color="white" />
        );
    }

    return (
        <Edges
            linewidth={5}
            threshold={60} // Display edges only when the angle between two faces exceeds this value (default=15 degrees)
            color="white"
        />
    );
}