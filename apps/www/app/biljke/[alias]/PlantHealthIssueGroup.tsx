import type { PlantData } from '@gredice/client';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { CommunityEntitySuggestionButton } from '../../../components/community-edits/CommunityEntitySuggestionButton';
import { PlantHealthIssueCard } from '../../../components/plant-health/PlantHealthIssueCard';
import { plantHealthOperationCount } from '../../../components/plant-health/PlantHealthIssueOperations';
import { plantHealthIssueDetailPath } from '../../../components/plant-health/plantHealthIssueContent';

type PlantHealth = PlantData['health'];
type PlantHealthIssueSummary = NonNullable<
    NonNullable<PlantHealth>['diseases']
>[number];

export function PlantHealthIssueGroup({
    title,
    kind,
    issues,
    plantId,
    plantName,
    publicPath,
}: {
    title: string;
    kind: 'disease' | 'pest';
    issues: PlantHealthIssueSummary[] | undefined;
    plantId: number;
    plantName: string;
    publicPath: string;
}) {
    return (
        <Stack spacing={3}>
            <Typography level="h2" className="text-xl">
                {title}
            </Typography>
            {issues?.length ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {issues.map((issue) => (
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
                </div>
            ) : null}
            <CommunityEntitySuggestionButton
                kind={kind}
                plants={[{ value: String(plantId), label: plantName }]}
                defaultAffectedPlantId={plantId}
                publicPath={publicPath}
                compact
            />
        </Stack>
    );
}
