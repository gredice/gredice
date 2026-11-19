import { CommunityEntitySuggestionButton } from '../../../components/community-edits/CommunityEntitySuggestionButton';
import { KnownPages } from '../../../src/KnownPages';

export function PlantSortSuggestionCard({
    basePlantId,
    basePlantName,
}: {
    basePlantId: number;
    basePlantName: string;
}) {
    return (
        <CommunityEntitySuggestionButton
            kind="plantSort"
            parentPlantId={basePlantId}
            parentPlantName={basePlantName}
            publicPath={KnownPages.Plant(basePlantName)}
        />
    );
}
