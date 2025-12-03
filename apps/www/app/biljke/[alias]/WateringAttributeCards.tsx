import type { PlantData } from '@gredice/client';
import { Droplet } from '@signalco/ui-icons';
import { AttributeCard } from '../../../components/attributes/DetailCard';

export function WateringAttributeCards({
    attributes,
}: {
    attributes: PlantData['attributes'] | undefined;
}) {
    return (
        <div className="grid grid-cols-2 gap-2">
            <AttributeCard
                icon={<Droplet />}
                header="Voda"
                value={attributes?.water ?? '-'}
            />
        </div>
    );
}
