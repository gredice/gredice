import type { PlantData } from '@gredice/client';
import { slug } from '@gredice/js/slug';
import { Accordion } from '@gredice/ui/Accordion';
import { Markdown } from '@gredice/ui/Markdown';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { CommunityEntitySuggestionButton } from '../../../components/community-edits/CommunityEntitySuggestionButton';
import type { CommunityContributorView } from '../../../components/community-edits/communityContributors';
import { SectionContributors } from '../../../components/community-edits/SectionContributors';
import { FeedbackModal } from '../../../components/shared/feedback/FeedbackModal';

export function PlantTips({
    contributors = [],
    plant,
    publicPath,
}: {
    /** Gardeners whose suggested tips were accepted, newest first. */
    contributors?: readonly CommunityContributorView[];
    plant: {
        id: number;
        information: { name: string; tip?: PlantData['information']['tip'] };
    };
    publicPath: string;
}) {
    return (
        <Stack spacing={4}>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <Typography
                    level="h2"
                    className="text-2xl"
                    id={slug('Savjeti')}
                >
                    Savjeti
                </Typography>
                <SectionContributors contributors={contributors} />
            </div>
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
                        <Stack spacing={4}>
                            <Markdown size="md">{tip.content}</Markdown>
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
                <CommunityEntitySuggestionButton
                    key={plant.id}
                    kind="plantTip"
                    parentPlantId={plant.id}
                    parentPlantName={plant.information.name}
                    publicPath={publicPath}
                    compact
                />
            </div>
        </Stack>
    );
}
