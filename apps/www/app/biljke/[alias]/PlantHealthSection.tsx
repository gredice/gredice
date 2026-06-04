import { slug } from '@gredice/js/slug';
import { Card } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type {
    PlantHealth,
    PlantHealthIssue,
} from '../../../lib/plants/plantRuntimeFields';
import { KnownPages } from '../../../src/KnownPages';

const operationGroups = [
    { key: 'prevention', label: 'Prevencija' },
    { key: 'reduction', label: 'Smanjenje pritiska' },
    { key: 'alleviation', label: 'Ublažavanje' },
] satisfies Array<{
    key: 'prevention' | 'reduction' | 'alleviation';
    label: string;
}>;

export function hasPlantHealth(health: PlantHealth | null | undefined) {
    return (
        (health?.diseases?.length ?? 0) > 0 || (health?.pests?.length ?? 0) > 0
    );
}

function issueKindLabel(issue: PlantHealthIssue) {
    return issue.kind === 'disease' ? 'Bolest' : 'Štetnik';
}

function issueBorderClassName(issue: PlantHealthIssue) {
    return issue.kind === 'disease' ? 'border-rose-500' : 'border-orange-500';
}

function PlantHealthOperations({
    operations,
}: {
    operations: PlantHealthIssue['operations'];
}) {
    if (!operations) {
        return null;
    }

    const groups = operationGroups
        .map((group) => ({
            ...group,
            operations: operations[group.key],
        }))
        .filter((group) => (group.operations?.length ?? 0) > 0);

    if (groups.length === 0) {
        return null;
    }

    return (
        <Stack spacing={2}>
            {groups.map((group) => (
                <Stack key={group.key} spacing={1}>
                    <Typography level="body2" semiBold>
                        {group.label}
                    </Typography>
                    <Row spacing={1} className="flex-wrap">
                        {group.operations?.map((operation) => (
                            <Chip
                                key={operation.id}
                                color="neutral"
                                href={KnownPages.Operation(
                                    operation.slug || operation.name,
                                )}
                            >
                                {operation.name}
                            </Chip>
                        ))}
                    </Row>
                </Stack>
            ))}
        </Stack>
    );
}

function PlantHealthIssueCard({ issue }: { issue: PlantHealthIssue }) {
    return (
        <Card className={`border-b-4 ${issueBorderClassName(issue)}`}>
            <Stack spacing={3}>
                <Row spacing={2} className="items-start justify-between">
                    <Typography level="h3" className="text-lg">
                        {issue.name}
                    </Typography>
                    <Chip color="neutral" size="sm">
                        {issueKindLabel(issue)}
                    </Chip>
                </Row>
                {issue.shortDescription && (
                    <Typography level="body2" className="text-gray-600">
                        {issue.shortDescription}
                    </Typography>
                )}
                {issue.symptoms && (
                    <Stack spacing={1}>
                        <Typography level="body2" semiBold>
                            Simptomi
                        </Typography>
                        <Typography level="body2">{issue.symptoms}</Typography>
                    </Stack>
                )}
                {issue.conditions && (
                    <Stack spacing={1}>
                        <Typography level="body2" semiBold>
                            Uvjeti
                        </Typography>
                        <Typography level="body2">
                            {issue.conditions}
                        </Typography>
                    </Stack>
                )}
                <PlantHealthOperations operations={issue.operations} />
            </Stack>
        </Card>
    );
}

function PlantHealthIssueGroup({
    issues,
    title,
}: {
    issues: PlantHealthIssue[] | null | undefined;
    title: string;
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
                    <PlantHealthIssueCard key={issue.id} issue={issue} />
                ))}
            </div>
        </Stack>
    );
}

export function PlantHealthSection({
    health,
}: {
    health: PlantHealth | null | undefined;
}) {
    if (!hasPlantHealth(health)) {
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
            <Stack spacing={6}>
                <PlantHealthIssueGroup
                    title="Bolesti"
                    issues={health?.diseases}
                />
                <PlantHealthIssueGroup
                    title="Štetnici"
                    issues={health?.pests}
                />
            </Stack>
        </Stack>
    );
}
