import { Typography } from "@signalco/ui-primitives/Typography";
import { Stack } from "@signalco/ui-primitives/Stack";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";
import { cx } from "@signalco/ui-primitives/cx";
import { Markdown } from "../../../components/shared/Markdown";
import { slug } from "@signalco/js";
import { FeedbackModal } from "../../../components/shared/feedback/FeedbackModal";
import { PlantOperations } from "./PlantOperations";
import { getOperationsData } from "../../../lib/plants/getOperationsData";

export type InformationSectionProps = {
    plantId: number
    id: string
    header: string
    content: string | null | undefined
    operations?: string[] | null
}

export async function InformationSection({ plantId, id, header, content, operations }: InformationSectionProps) {
    if (!content) {
        return null;
    }

    const operationsData = await getOperationsData();
    const applicableOperations = operationsData.filter((operation) => {
        const operationId = operation.information.name.toLowerCase();
        const idMatched = operations?.some((op) => op.toLowerCase() === operationId) ?? false;
        const sectionMatched = operation.attributes.stage === id;
        return idMatched && sectionMatched;
    });

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 group">
            <Typography id={slug(header)} level="h2" className="text-2xl md:col-span-2">{header}</Typography>
            <Markdown>{content}</Markdown>
            <Stack className={cx("border rounded-lg p-2 h-fit", !applicableOperations?.length && 'justify-center')}>
                {(applicableOperations?.length ?? 0) <= 0 && (
                    <div className="py-4">
                        <NoDataPlaceholder>
                            Nema dostupnih akcija
                        </NoDataPlaceholder>
                    </div>
                )}
                {(applicableOperations?.length ?? 0) > 0 && (
                    <PlantOperations operations={applicableOperations} />
                )}
            </Stack>
            <FeedbackModal
                className="md:group-hover:opacity-100 md:opacity-0 transition-opacity ml-auto"
                topic="www/plants/information"
                data={{
                    plantId: plantId,
                    sectionId: id
                }}
            />
        </div>
    )
}
