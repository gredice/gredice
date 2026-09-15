import { GamePlantDiseaseIcon, GamePlantPestIcon } from '@gredice/ui/GameIcons';
import { normalizeSearchText } from '../../lib/search/normalizeSearchText';
import { PublicEmptyState } from '../shared/placeholders/PublicEmptyState';
import { PlantHealthIssueCard } from './PlantHealthIssueCard';
import { plantHealthOperationCount } from './PlantHealthIssueOperations';
import {
    type PlantHealthIssueData,
    type PlantHealthIssueKind,
    plantHealthIssueDetailPath,
    plantHealthIssueShortDescription,
    plantHealthIssueTitle,
} from './plantHealthIssueContent';

function issueMatchesSearch(issue: PlantHealthIssueData, search: string) {
    const query = normalizeSearchText(search);
    if (!query) {
        return true;
    }

    const searchableText = normalizeSearchText(
        [
            issue.information.name,
            issue.information.label,
            issue.information.shortDescription,
            issue.information.description,
            issue.symptoms?.symptoms,
            issue.conditions?.favorableConditions,
            issue.relationships?.affectedPlants
                ?.map((plant) => plant.name)
                .join(' '),
        ].join(' '),
    );

    return searchableText.includes(query);
}

export function PlantHealthIssueDirectory({
    issues,
    kind,
    search,
}: {
    issues: PlantHealthIssueData[];
    kind: PlantHealthIssueKind;
    search: string;
}) {
    const filteredIssues = issues
        .filter((issue) => issueMatchesSearch(issue, search))
        .sort((left, right) =>
            plantHealthIssueTitle(left).localeCompare(
                plantHealthIssueTitle(right),
                'hr',
            ),
        );

    if (filteredIssues.length === 0) {
        return (
            <PublicEmptyState
                icon={
                    kind === 'disease'
                        ? GamePlantDiseaseIcon
                        : GamePlantPestIcon
                }
                className="rounded border"
            >
                Nema zapisa za zadani pojam.
            </PublicEmptyState>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredIssues.map((issue) => {
                const title = plantHealthIssueTitle(issue);
                return (
                    <PlantHealthIssueCard
                        key={issue.id}
                        issue={{
                            id: issue.id,
                            href: plantHealthIssueDetailPath(
                                kind,
                                issue.slug || title,
                            ),
                            kind,
                            title,
                            shortDescription:
                                plantHealthIssueShortDescription(issue),
                            affectedPlantNames:
                                issue.relationships?.affectedPlants?.map(
                                    (plant) => plant.name,
                                ),
                            operationCount: plantHealthOperationCount(
                                issue.operations,
                            ),
                        }}
                    />
                );
            })}
        </div>
    );
}
