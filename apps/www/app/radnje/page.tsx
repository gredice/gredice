import { Stack } from "@signalco/ui-primitives/Stack";
import { PageHeader } from "../../components/shared/PageHeader";
import { getOperationsData, OperationData } from "../../lib/plants/getOperationsData";
import { Typography } from "@signalco/ui-primitives/Typography";
import { OperationImage } from "@gredice/ui/OperationImage";
import { Row } from "@signalco/ui-primitives/Row";
import { Card, CardContent } from "@signalco/ui-primitives/Card";
import { KnownPages } from "../../src/KnownPages";
import { FeedbackModal } from "../../components/shared/feedback/FeedbackModal";

export const revalidate = 3600; // 1 hour
export const metadata = {
    title: "Radnje",
    description: "Sve što trebaš znati o radnjama koje možeš obavljati u svojim gredicama.",
};

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
        <Stack spacing={4}>
            <PageHeader
                header="Radnje"
                subHeader={`Sve što trebaš znati o radnjama koje možeš obavljati u svojim gredicama.`}
                padded
            />
            <Stack spacing={4}>
                {!operationsData?.length && (
                    <div>Nema dostupnih radnji.</div>
                )}
                {stagesLabels.map((stageLabel) => (
                    <Stack key={stageLabel} spacing={1}>
                        <Typography level="h3">{stageLabel}</Typography>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {operationsData
                                ?.filter(op => op.attributes.stage?.information?.label === stageLabel)
                                .sort((a, b) => a.information.label.localeCompare(b.information.label))
                                .map((operation) => (
                                    <OperationCard key={operation.id} operation={operation} />
                                ))}
                        </div>
                    </Stack>
                ))}
            </Stack>
            <Row spacing={2}>
                <Typography level="body1">Jesu li ti informacije o radnjama korisne?</Typography>
                <FeedbackModal
                    topic="www/operations"
                />
            </Row>
        </Stack>
    );
}