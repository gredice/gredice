import { Card, CardContent } from '@signalco/ui-primitives/Card';
import type { PlantControlsProps } from '../@types/plant-generator';
import { PlantControls } from './PlantControl';

export function DesktopControls(props: PlantControlsProps) {
    return (
        <div className="absolute inset-y-0 left-0 z-40 hidden min-h-0 md:block md:w-[26rem] md:max-w-[40vw] md:p-2">
            <Card className="h-full overflow-hidden shadow-2xl">
                <CardContent noHeader className="h-full overflow-hidden">
                    <PlantControls {...props} />
                </CardContent>
            </Card>
        </div>
    );
}
