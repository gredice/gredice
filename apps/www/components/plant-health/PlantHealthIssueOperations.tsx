import { Chip } from '@gredice/ui/Chip';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { KnownPages } from '../../src/KnownPages';
import { operationIntentLabel } from './plantHealthIssueContent';

type OperationSummary = {
    id: number;
    slug: string;
    name: string;
    label?: string;
};

type PlantHealthOperations = Partial<
    Record<'prevention' | 'reduction' | 'alleviation', OperationSummary[]>
>;

export function plantHealthOperationCount(
    operations: PlantHealthOperations | null | undefined,
) {
    return Object.values(operations ?? {}).reduce(
        (count, entries) => count + (entries?.length ?? 0),
        0,
    );
}

export function PlantHealthIssueOperations({
    operations,
}: {
    operations: PlantHealthOperations | null | undefined;
}) {
    const entries = Object.entries(operations ?? {}).filter(
        (entry): entry is [keyof PlantHealthOperations, OperationSummary[]] =>
            (entry[1]?.length ?? 0) > 0,
    );

    if (entries.length === 0) {
        return null;
    }

    return (
        <Stack spacing={4}>
            {entries.map(([intent, intentOperations]) => (
                <Stack key={intent} spacing={2}>
                    <Typography level="h4" component="h3">
                        {operationIntentLabel(intent)}
                    </Typography>
                    <Row spacing={2} className="flex-wrap">
                        {intentOperations.map((operation) => (
                            <Chip
                                key={operation.id}
                                color="neutral"
                                href={KnownPages.Operation(
                                    operation.slug ||
                                        operation.label ||
                                        operation.name,
                                )}
                            >
                                {operation.label || operation.name}
                            </Chip>
                        ))}
                    </Row>
                </Stack>
            ))}
        </Stack>
    );
}
