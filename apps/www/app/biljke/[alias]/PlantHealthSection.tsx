import type { PlantData } from '@gredice/client';
import type { CommunityContributorView } from '../../../components/community-edits/communityContributors';
import { PlantHealthIssueGroup } from './PlantHealthIssueGroup';
import { plantHealthSectionId } from './plantPageSections';

export function PlantHealthSection({
    diseaseContributors,
    health,
    pestContributors,
    plantId,
    plantName,
    publicPath,
}: {
    /** Gardeners whose suggested diseases were accepted for this plant. */
    diseaseContributors?: readonly CommunityContributorView[];
    /** Gardeners whose suggested pests were accepted for this plant. */
    pestContributors?: readonly CommunityContributorView[];
    health: PlantData['health'] | null | undefined;
    plantId: number;
    plantName: string;
    publicPath: string;
}) {
    return (
        <div
            id={plantHealthSectionId}
            className="grid grid-cols-1 gap-6 lg:grid-cols-2"
        >
            <PlantHealthIssueGroup
                title="Poznate bolesti"
                kind="disease"
                contributors={diseaseContributors}
                issues={health?.diseases}
                plantId={plantId}
                plantName={plantName}
                publicPath={publicPath}
            />
            <PlantHealthIssueGroup
                title="Poznati štetnici"
                kind="pest"
                contributors={pestContributors}
                issues={health?.pests}
                plantId={plantId}
                plantName={plantName}
                publicPath={publicPath}
            />
        </div>
    );
}
