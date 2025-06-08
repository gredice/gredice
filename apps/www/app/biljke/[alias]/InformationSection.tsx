import { Typography } from "@signalco/ui-primitives/Typography";
import { Stack } from "@signalco/ui-primitives/Stack";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";
import { cx } from "@signalco/ui-primitives/cx";
import { Markdown } from "../../../components/shared/Markdown";
import { slug } from "@signalco/js";
import { FeedbackModal } from "../../../components/shared/feedback/FeedbackModal";
import { PlantOperations } from "./PlantOperations";
import { PlantData } from "@gredice/client";
import { getOperationsData } from "../../../lib/plants/getOperationsData";

export type InformationSectionProps = {
    plantId: number
    id: string
    header: string
    content: string | null | undefined,
    sortContent?: string | null | undefined,
    operations?: PlantData["information"]["operations"] | null | undefined
}

export async function InformationSection({ plantId, id, header, content, sortContent, operations }: InformationSectionProps) {
    if (!content) {
        return null;
    }

    // Filter operations based on stage
    const allOperations = await getOperationsData();
    const gardenOperations = allOperations?.filter((operation) => operation.attributes?.application === "garden" && operation.attributes?.stage === id);
    const raisedBedFullOperations = allOperations?.filter((operation) => operation.attributes?.application === "raisedBedFull" && operation.attributes?.stage === id);
    const raisedBedSquareOperations = allOperations?.filter((operation) => operation.attributes?.application === "raisedBed1m" && operation.attributes?.stage === id);
    const plantOperations = operations?.filter((operation) => operation.attributes?.application === "plant" && operation.attributes?.stage === id);
    const applicableOperations = [
        ...(gardenOperations ?? []),
        ...(raisedBedFullOperations ?? []),
        ...(raisedBedSquareOperations ?? []),
        ...(plantOperations ?? [])
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 group">
            <Typography id={slug(header)} level="h2" className="text-2xl md:col-span-2">{header}</Typography>
            <Stack spacing={1}>
                {sortContent && (
                    <Stack>
                        <Typography level="body2" className="-mb-2">
                            Specifično za ovu sortu:
                        </Typography>
                        <Markdown>{sortContent}</Markdown>
                    </Stack>
                )}
                <Stack>
                    {sortContent && (
                        <Typography level="body2" className="-mb-2">
                            Za biljku:
                        </Typography>
                    )}
                    <Markdown>{content}</Markdown>
                </Stack>
            </Stack>
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
