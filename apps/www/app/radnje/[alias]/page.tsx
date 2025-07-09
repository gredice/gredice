import { Stack } from "@signalco/ui-primitives/Stack";
import { getOperationsData } from "../../../lib/plants/getOperationsData";
import { PageHeader } from "../../../components/shared/PageHeader";
import { notFound } from "next/navigation";

export default async function OperationPage({ params }: { params: Promise<{ alias: string }> }) {
    const { alias: aliasUnescaped } = await params;
    const alias = decodeURIComponent(aliasUnescaped);
    const operationsData = await getOperationsData();
    const operation = operationsData?.find(op => op.information.label === alias);
    if (!operation) {
        notFound();
    }

    return (
        <Stack>
            <PageHeader
                header={operation.information.label}
                subHeader={operation.information.shortDescription}
                padded
            />
        </Stack>
    );
}