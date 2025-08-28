import { Menu } from '@signalco/ui-icons';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Popper } from '@signalco/ui-primitives/Popper';
import type { PlantControlsProps } from '../@types/plant-generator';
import { PlantControls } from './PlantControl';

interface MobileControlsProps extends PlantControlsProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function MobileControls({
    isOpen,
    onOpenChange,
    ...controlProps
}: MobileControlsProps) {
    return (
        <div className="md:hidden">
            <Popper
                open={isOpen}
                onOpenChange={onOpenChange}
                trigger={
                    <IconButton title="Izbornik">
                        <Menu className="size-4 shrink-0" />
                    </IconButton>
                }
            >
                <Card className="shadow-2xl">
                    <CardContent noHeader>
                        <PlantControls {...controlProps} />
                    </CardContent>
                </Card>
            </Popper>
        </div>
    );
}
