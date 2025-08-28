import { Card, CardContent } from '@signalco/ui-primitives/Card';
import type { PlantControlsProps } from '../@types/plant-generator';
import { PlantControls } from './PlantControl';

export function DesktopControls(props: PlantControlsProps) {
    return (
        <div className="hidden md:block absolute top-2 left-2 w-full max-w-sm">
            <Card className="shadow-2xl">
                <CardContent noHeader>
                    <PlantControls {...props} />
                </CardContent>
            </Card>
        </div>
    );
}
