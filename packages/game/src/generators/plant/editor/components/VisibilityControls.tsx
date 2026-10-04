'use client';

import { Checkbox } from '@gredice/ui/Checkbox';
import { Divider } from '@gredice/ui/Divider';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { VisibilityState } from '../@types/plant-generator';

interface VisibilityControlsProps {
    visibility: VisibilityState;
    onVisibilityChange: (updates: Partial<VisibilityState>) => void;
}

export function VisibilityControls({
    visibility,
    onVisibilityChange,
}: VisibilityControlsProps) {
    return (
        <Stack spacing={4}>
            <Divider />
            <Typography className="text-sm font-medium">Prikaz</Typography>
            <Checkbox
                id="show-leaves"
                label="Prikaži listove"
                checked={visibility.showLeaves}
                onCheckedChange={(checked: boolean) =>
                    onVisibilityChange({ showLeaves: checked })
                }
                className="h-4 w-4"
            />
            <Checkbox
                id="show-flowers"
                label="Prikaži cvijetove"
                checked={visibility.showFlowers}
                onCheckedChange={(checked: boolean) =>
                    onVisibilityChange({ showFlowers: checked })
                }
                className="h-4 w-4"
            />
            <Checkbox
                id="show-produce"
                label="Prikaži plodove"
                checked={visibility.showProduce}
                onCheckedChange={(checked: boolean) =>
                    onVisibilityChange({ showProduce: checked })
                }
                className="h-4 w-4"
            />
        </Stack>
    );
}
