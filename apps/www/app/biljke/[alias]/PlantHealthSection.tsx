import type { PlantData } from '@gredice/client';
import { PlantHealthIssueGroup } from './PlantHealthIssueGroup';

export function PlantHealthSection({
    health,
    plantId,
    plantName,
    publicPath,
}: {
    health: PlantData['health'] | null | undefined;
    plantId: number;
    plantName: string;
    publicPath: string;
}) {
    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <PlantHealthIssueGroup
                title="Poznate bolesti"
                kind="disease"
                issues={health?.diseases}
                plantId={plantId}
                plantName={plantName}
                publicPath={publicPath}
            />
            <PlantHealthIssueGroup
                title="Poznati štetnici"
                kind="pest"
                issues={health?.pests}
                plantId={plantId}
                plantName={plantName}
                publicPath={publicPath}
            />
        </div>
    );
}
