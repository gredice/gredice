import { Stack } from "@signalco/ui-primitives/Stack";
import { PageHeader } from "../../components/shared/PageHeader";
import { getOperationsData, OperationData } from "../../lib/plants/getOperationsData";
import { Typography } from "@signalco/ui-primitives/Typography";
import { OperationImage } from "../../components/operations/OperationImage";
import { Row } from "@signalco/ui-primitives/Row";
import { Card, CardContent } from "@signalco/ui-primitives/Card";
import { KnownPages } from "../../src/KnownPages";

function OperationCard({ operation }: { operation: OperationData }) {
    return (
        <Card href={KnownPages.Operation(operation.information.label)}>
            <CardContent noHeader>
                <Row justifyContent="space-between">
                    <Row spacing={2}>
                        <OperationImage operation={operation} />
                        <Stack>
                            <Typography level="h6" component="h3">{operation.information.label}</Typography>
                            <Typography level="body2">{operation.information.shortDescription}</Typography>
                        </Stack>
                    </Row>
                    <Typography>
                        {operation.prices.perOperation.toFixed(2)}€
                    </Typography>
                </Row>
            </CardContent>
        </Card>
    );
}

export default async function OperationsPage() {
    const operationsData = await getOperationsData();
    const stagesLabels = [...new Set(operationsData?.map(op => op.attributes.stage?.information?.label) || [])];

    return (
        <Stack>
            <PageHeader
                header="Radnje"
                subHeader={`Sve što trebaš znati o radnjama koje možeš obavljati u svojim gredicama 🪏`}
                padded
            />
            <Stack spacing={2}>
                {!operationsData?.length && (
                    <div>Nema dostupnih radnji.</div>
                )}
                {stagesLabels.map((stageLabel) => (
                    <Stack key={stageLabel} spacing={1}>
                        <Typography level="h2">{stageLabel}</Typography>
                        {operationsData
                            ?.filter(op => op.attributes.stage?.information?.label === stageLabel)
                            .map((operation) => (
                                <OperationCard key={operation.id} operation={operation} />
                            ))}
                    </Stack>
                ))}
            </Stack>
        </Stack>
    );
}