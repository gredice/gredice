import { normalizeSearchText } from '../../lib/search/normalizeSearchText';
import { NoDataPlaceholder } from '../shared/placeholders/NoDataPlaceholder';
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
            <div className="rounded border py-6">
                <NoDataPlaceholder>
                    Nema zapisa za zadani pojam.
                </NoDataPlaceholder>
            </div>
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
