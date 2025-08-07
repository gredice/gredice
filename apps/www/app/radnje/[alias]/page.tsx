import { Stack } from "@signalco/ui-primitives/Stack";
import { getOperationsData } from "../../../lib/plants/getOperationsData";
import { PageHeader } from "../../../components/shared/PageHeader";
import { notFound } from "next/navigation";
import { Markdown } from "../../../components/shared/Markdown";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { FeedbackModal } from "../../../components/shared/feedback/FeedbackModal";
import { OperationAttributesCards } from "./OperationAttributesCards";
import { OperationImage } from "@gredice/ui/OperationImage";
import { KnownPages } from "../../../src/KnownPages";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { Euro } from "@signalco/ui-icons";
import { AttributeCard } from "../../../components/attributes/DetailCard";
import { OperationApplicationsList } from "./OperationApplicationsList";

export default async function OperationPage({ params }: { params: Promise<{ alias: string }> }) {
    const { alias: aliasUnescaped } = await params;
    const alias = decodeURIComponent(aliasUnescaped);
    const operationsData = await getOperationsData();
    const operation = operationsData?.find(op => op.information.label === alias);
    if (!operation) {
        notFound();
    }

    return (
        <div className="py-8">
            <Stack spacing={4}>
                <Breadcrumbs items={[
                    { label: 'Radnje', href: KnownPages.Operations },
                    { label: operation.information.label }
                ]} />
                <PageHeader
                    visual={<OperationImage operation={operation} size={128} />}
                    header={operation.information.label}
                    subHeader={operation.information.shortDescription}
                >
                    <Stack>
                        <Stack spacing={1} className="group">
                            <Typography level="h2" className="text-2xl">Informacije</Typography>
                            <div className="grid grid-cols-2 gap-2">
                                <AttributeCard
                                    icon={<Euro />}
                                    header="Cijena"
                                    value={`${operation.prices.perOperation.toFixed(2)}€`} />
                            </div>
                            <FeedbackModal
                                topic={"www/operations/information"}
                                data={{
                                    operationId: operation.id,
                                    operationAlias: alias
                                }}
                                className="self-end group-hover:opacity-100 opacity-0 transition-opacity" />
                        </Stack>
                        <Stack spacing={1} className="group">
                            <Typography level="h2" className="text-2xl">Svojstva</Typography>
                            <OperationAttributesCards attributes={operation.attributes} />
                            <FeedbackModal
                                topic={"www/operations/attributes"}
                                data={{
                                    operationId: operation.id,
                                    operationAlias: alias
                                }}
                                className="self-end group-hover:opacity-100 opacity-0 transition-opacity" />
                        </Stack>
                    </Stack>
                </PageHeader>
                <div className="max-w-xl">
                    <Markdown>
                        {operation.information.description || "Nema opisa za ovu radnju."}
                    </Markdown>
                </div>
                <Stack>
                    <Typography level="h2" className="text-2xl">Dostupno za</Typography>
                    <OperationApplicationsList
                        operationId={operation.id} />
                </Stack>
                <Row spacing={2}>
                    <Typography level="body1">Jesu li ti informacije o ovoj radnji korisne?</Typography>
                    <FeedbackModal
                        topic="www/operations/details"
                        data={{
                            operationId: operation.id,
                            operationAlias: alias
                        }} />
                </Row>
            </Stack>
        </div>
    );
}