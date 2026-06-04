import type { PlantData } from '@gredice/client';
import { slug } from '@gredice/js/slug';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { PlantHealthIssueCard } from '../../../components/plant-health/PlantHealthIssueCard';
import { plantHealthOperationCount } from '../../../components/plant-health/PlantHealthIssueOperations';
import { plantHealthIssueDetailPath } from '../../../components/plant-health/plantHealthIssueContent';

type PlantHealthIssueSummary = NonNullable<
    NonNullable<PlantData['health']>['diseases']
>[number];

function PlantHealthIssueGroup({
    title,
    kind,
    issues,
}: {
    title: string;
    kind: 'disease' | 'pest';
    issues: PlantHealthIssueSummary[] | undefined;
}) {
    if (!issues?.length) {
        return null;
    }

    return (
        <Stack spacing={3}>
            <Typography level="h3" className="text-xl">
                {title}
            </Typography>
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
        </Stack>
    );
}

export function PlantHealthSection({
    health,
}: {
    health: PlantData['health'] | undefined;
}) {
    const hasDiseases = (health?.diseases?.length ?? 0) > 0;
    const hasPests = (health?.pests?.length ?? 0) > 0;

    if (!hasDiseases && !hasPests) {
        return null;
    }

    return (
        <Stack spacing={4}>
            <Typography
                level="h2"
                className="text-2xl"
                id={slug('Zdravlje biljke')}
            >
                Zdravlje biljke
            </Typography>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <PlantHealthIssueGroup
                    title="Poznate bolesti"
                    kind="disease"
                    issues={health?.diseases}
                />
                <PlantHealthIssueGroup
                    title="Poznati štetnici"
                    kind="pest"
                    issues={health?.pests}
                />
            </div>
        </Stack>
    );
}
