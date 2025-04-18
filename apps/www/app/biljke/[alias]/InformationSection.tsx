import { Typography } from "@signalco/ui-primitives/Typography";
import { Stack } from "@signalco/ui-primitives/Stack";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";
import { cx } from "@signalco/ui-primitives/cx";
import { Markdown } from "../../../components/shared/Markdown";
import { slug } from "@signalco/js";
import { FeedbackModal } from "../../../components/shared/feedback/FeedbackModal";
import { PlantingInstructions, PlantInstruction } from "./PlantingInstructions";

export type InformationSectionProps = {
    plantId: number
    id: string
    header: string
    content: string | null | undefined
    instructions?: PlantInstruction[]
}

export function InformationSection({ plantId, id, header, content, instructions }: InformationSectionProps) {
    if (!content) {
        return null;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 group">
            <div className="flex justify-between">
                <Typography id={slug(header)} level="h2" className="text-2xl">{header}</Typography>
                <FeedbackModal
                    className="group-hover:opacity-100 opacity-0 transition-opacity"
                    topic="www/plants/information"
                    data={{
                        plantId: plantId,
                        sectionId: id
                    }}
                />
            </div>
            <div className="hidden md:block" />
            <Markdown>{content}</Markdown>
            <Stack className={cx("border rounded-lg p-2 h-fit", !instructions?.length && 'justify-center')}>
                {(instructions?.length ?? 0) <= 0 && (
                    <NoDataPlaceholder className="self-center py-4">
                        Nema dostupnih akcija
                    </NoDataPlaceholder>
                )}
                {(instructions?.length ?? 0) > 0 && (
                    <PlantingInstructions instructions={instructions} />
                )}
            </Stack>
        </div>
    )
}
