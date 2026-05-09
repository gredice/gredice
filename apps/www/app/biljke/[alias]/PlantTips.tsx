import type { PlantData } from '@gredice/client';
import { Accordion } from '@signalco/ui/Accordion';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { FeedbackModal } from '../../../components/shared/feedback/FeedbackModal';

export function PlantTips({
    plant,
}: {
    plant: {
        id: number;
        information?: { tip?: PlantData['information']['tip'] };
    };
}) {
    return (
        <Stack spacing={2}>
            <Typography level="h2" className="text-2xl">
                Savjeti
            </Typography>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plant.information?.tip?.map((tip) => (
                    <Accordion
                        defaultOpen
                        key={tip.header}
                        className="h-fit border-tertiary border-b-4"
                    >
                        <Typography
                            level="h3"
                            className="text-lg"
                            semiBold
                            secondary
                        >
                            {tip.header}
                        </Typography>
                        <Stack spacing={2}>
                            <Typography>{tip.content}</Typography>
                            <FeedbackModal
                                className="self-end"
                                topic="www/plants/advice"
                                data={{
                                    plantId: plant.id,
                                    tipHeader: tip.header,
                                }}
                            />
                        </Stack>
                    </Accordion>
                ))}
            </div>
        </Stack>
    );
}
