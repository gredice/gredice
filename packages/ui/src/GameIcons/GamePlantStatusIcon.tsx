import { plantFieldStatusLabel } from '@gredice/js/plants';
import type { SVGProps } from 'react';
import { GameIconFrame } from './GameIconFrame';
import { getPlantStatusArtwork } from './plantStatusArtwork';

/** Illustrated lifecycle status; labels and status transitions remain domain-owned. */
export function GamePlantStatusIcon({
    status,
    ...props
}: SVGProps<SVGSVGElement> & { status?: string | null }) {
    const { source, overlay } = getPlantStatusArtwork(status);
    const label = plantFieldStatusLabel(status ?? undefined).shortLabel;
    const decorative =
        props['aria-hidden'] === true || props['aria-hidden'] === 'true';
    return (
        <GameIconFrame
            label={decorative ? undefined : label}
            source={source}
            role="img"
            aria-label={label}
            data-plant-status-icon={status ?? 'unknown'}
            {...props}
        >
            {overlay && (
                <image
                    href={typeof overlay === 'string' ? overlay : overlay.src}
                    x={24}
                    y={24}
                    width={24}
                    height={24}
                    preserveAspectRatio="xMidYMid meet"
                />
            )}
        </GameIconFrame>
    );
}
