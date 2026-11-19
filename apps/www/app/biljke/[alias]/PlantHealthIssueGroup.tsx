import type { PlantData } from '@gredice/client';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { CommunityEntitySuggestionButton } from '../../../components/community-edits/CommunityEntitySuggestionButton';
import type { CommunityContributorView } from '../../../components/community-edits/communityContributors';
import { SectionContributors } from '../../../components/community-edits/SectionContributors';
import { PlantHealthIssueCard } from '../../../components/plant-health/PlantHealthIssueCard';
import { plantHealthOperationCount } from '../../../components/plant-health/PlantHealthIssueOperations';
import { plantHealthIssueDetailPath } from '../../../components/plant-health/plantHealthIssueContent';

type PlantHealth = PlantData['health'];
type PlantHealthIssueSummary = NonNullable<
    NonNullable<PlantHealth>['diseases']
>[number];

export function PlantHealthIssueGroup({
    contributors = [],
    title,
    kind,
    issues,
    plantId,
    plantName,
    publicPath,
}: {
    /** Gardeners whose suggested records were accepted, newest first. */
    contributors?: readonly CommunityContributorView[];
    title: string;
    kind: 'disease' | 'pest';
    issues: PlantHealthIssueSummary[] | undefined;
    plantId: number;
    plantName: string;
    publicPath: string;
}) {
    return (
        <Stack spacing={3}>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <Typography level="h2" className="text-xl">
                    {title}
                </Typography>
                <SectionContributors contributors={contributors} />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {issues?.map((issue) => (
                    <PlantHealthIssueCard
                        key={issue.id}
                        issue={{
                            id: issue.id,
                            href: plantHealthIssueDetailPath(
                                kind,
                                issue.slug || issue.name,
                            ),
                            kind,
                            title: issue.name,
                            shortDescription: issue.shortDescription,
                            symptoms: issue.symptoms,
                            operationCount: plantHealthOperationCount(
                                issue.operations,
                            ),
                        }}
                    />
                ))}
                <CommunityEntitySuggestionButton
                    key={plantId}
                    kind={kind}
                    plants={[{ value: String(plantId), label: plantName }]}
                    defaultAffectedPlantId={plantId}
                    publicPath={publicPath}
                    compact
                />
            </div>
        </Stack>
    );
}
