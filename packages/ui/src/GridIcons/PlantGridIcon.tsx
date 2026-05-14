import type { SVGProps } from 'react';
import { Grid1Icon } from './Grid1Icon';
import { Grid4Icon } from './Grid4Icon';
import { Grid9Icon } from './Grid9Icon';
import { Grid16Icon } from './Grid16Icon';

export interface PlantGridIconProps extends SVGProps<SVGSVGElement> {
    /**
     * Total number of plants per field.
     * Supported values: 1, 4, 9, 16
     * For other values, defaults to the closest supported value.
     */
    totalPlants: number;
}

/**
 * Displays a grid icon based on the number of plants per field.
 * Automatically selects the appropriate icon based on totalPlants value.
 */
export function PlantGridIcon({ totalPlants, ...props }: PlantGridIconProps) {
    // Find the closest supported grid value
    const getGridIcon = (plants: number) => {
        if (plants <= 1) return Grid1Icon;
        if (plants <= 4) return Grid4Icon;
        if (plants <= 9) return Grid9Icon;
        return Grid16Icon;
    };

    const IconComponent = getGridIcon(totalPlants);

    return <IconComponent {...props} />;
}
