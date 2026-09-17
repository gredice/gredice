import { GameSeedlingIcon } from '@gredice/ui/GameIcons';
import type { SVGProps } from 'react';
import soil from './assets/density-soil.webp';
import spot from './assets/density-spot.webp';

/** A Storybook design proposal, deliberately separate from runtime density rules. */
export function SowingDensityConceptIcon({
    totalPlants,
    treatment = 'spots',
    ...props
}: SVGProps<SVGSVGElement> & {
    totalPlants: 1 | 4 | 9 | 16;
    treatment?: 'spots' | 'seedlings';
}) {
    const columns = Math.sqrt(totalPlants);
    const cellWidth = 32 / columns;
    const cellHeight = 29 / columns;
    const markerSize = Math.min(cellWidth, cellHeight) * 0.95;
    const positions = Array.from({ length: totalPlants }, (_, index) => ({
        column: index % columns,
        row: Math.floor(index / columns),
    }));

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={24}
            height={24}
            viewBox="0 0 48 48"
            role="img"
            aria-label={`Broj biljaka po polju: ${totalPlants}`}
            data-density-concept={totalPlants}
            {...props}
        >
            <title>{`Broj biljaka po polju: ${totalPlants}`}</title>
            <image
                href={typeof soil === 'string' ? soil : soil.src}
                width={48}
                height={48}
            />
            {positions.map(({ row, column }) => {
                const x = 8 + (column + 0.5) * cellWidth - markerSize / 2;
                const y = 7 + (row + 0.5) * cellHeight - markerSize / 2;
                return (
                    <g key={`${row}-${column}`} data-planting-position>
                        {treatment === 'spots' ? (
                            <image
                                href={
                                    typeof spot === 'string' ? spot : spot.src
                                }
                                x={x}
                                y={y}
                                width={markerSize}
                                height={markerSize}
                            />
                        ) : (
                            <GameSeedlingIcon
                                aria-hidden
                                x={x}
                                y={y}
                                width={markerSize}
                                height={markerSize}
                            />
                        )}
                    </g>
                );
            })}
        </svg>
    );
}
