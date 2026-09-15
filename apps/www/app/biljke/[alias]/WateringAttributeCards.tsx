import type { PlantData } from '@gredice/client';
import { GameWaterIcon } from '@gredice/ui/GameIcons';
import { AttributeCard } from '../../../components/attributes/DetailCard';

export function WateringAttributeCards({
    attributes,
}: {
    attributes: PlantData['attributes'] | undefined;
}) {
    return (
        <div className="grid grid-cols-2 gap-2">
            <AttributeCard
                icon={<GameWaterIcon aria-hidden />}
                header="Voda"
                value={attributes?.water ?? '-'}
            />
        </div>
    );
}
