import { type SVGProps, useId } from 'react';
import { GameIconFrame } from '../GameIcons/GameIconFrame';
import soil from './assets/density-soil.webp';
import spot from './assets/density-spot.webp';
import { plantGridLayout } from './plantGridLayout';

export interface PlantGridIconProps extends SVGProps<SVGSVGElement> {
    /**
     * Exact number of plants per field, including dense layouts above 16.
     * Keep the numeric count beside the icon at compact sizes.
     */
    totalPlants: number;
}

/**
 * Repeats one planting spot over the shared soil tile.
 * An SVG pattern keeps DOM size constant even for very dense layouts.
 */
export function PlantGridIcon({ totalPlants, ...props }: PlantGridIconProps) {
    const patternId = useId();
    const layout = plantGridLayout(totalPlants);
    const cellWidth = 32 / (layout?.columns ?? 1);
    const cellHeight = 29 / (layout?.columns ?? 1);
    const markerSize = Math.min(cellWidth, cellHeight) * 0.95;

    return (
        <GameIconFrame
            source={soil}
            label={
                layout
                    ? `Broj biljaka po polju: ${totalPlants}`
                    : 'Broj biljaka nije poznat'
            }
            aria-hidden
            data-plant-grid-count={layout ? totalPlants : undefined}
            {...props}
        >
            {layout && totalPlants > 0 && (
                <svg
                    aria-hidden="true"
                    x={8}
                    y={7}
                    width={32}
                    height={29}
                    viewBox="0 0 32 29"
                >
                    <defs>
                        <pattern
                            id={patternId}
                            patternUnits="userSpaceOnUse"
                            width={cellWidth}
                            height={cellHeight}
                        >
                            <image
                                href={
                                    typeof spot === 'string' ? spot : spot.src
                                }
                                x={(cellWidth - markerSize) / 2}
                                y={(cellHeight - markerSize) / 2}
                                width={markerSize}
                                height={markerSize}
                            />
                        </pattern>
                    </defs>
                    <rect
                        width={32}
                        height={layout.fullRows * cellHeight}
                        fill={`url(#${patternId})`}
                    />
                    {layout.lastRowPlants > 0 && (
                        <rect
                            x={0}
                            y={layout.fullRows * cellHeight}
                            width={layout.lastRowPlants * cellWidth}
                            height={cellHeight}
                            fill={`url(#${patternId})`}
                        />
                    )}
                </svg>
            )}
        </GameIconFrame>
    );
}
