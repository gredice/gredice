import { Stack } from '@gredice/ui/Stack';
import { sunflowerMascotArtwork } from '@gredice/ui/SunflowerVisuals';
import Image from 'next/image';
import { ButtonGreen } from '../../shared-ui/ButtonGreen';
import { useSuncokretChat } from '../SuncokretChatProvider';
import type { PhotoAnalysisRequest } from './photoAnalysisChat';

type RaisedBedDiaryAiActionProps = Omit<
    PhotoAnalysisRequest,
    'key' | 'historyEntryId'
> & {
    raisedBedId: number;
    positionIndex?: number;
};

export function RaisedBedDiaryAiAction({
    gardenId,
    raisedBedId,
    positionIndex,
    ...analysis
}: RaisedBedDiaryAiActionProps) {
    const chat = useSuncokretChat();
    const latestCompleteHistoryEntry = analysis.historyEntries?.find((entry) =>
        analysis.imageUrls.every((url) => entry.imageUrls?.includes(url)),
    );
    return (
        <Stack spacing={2} className="items-end">
            <ButtonGreen
                size="sm"
                disabled={!chat || !analysis.imageUrls.length}
                className="w-fit self-end px-3 dark:from-green-700 dark:to-green-800 dark:text-white dark:hover:from-green-600 dark:hover:to-green-700 dark:hover:text-white"
                onClick={(event) => {
                    event.stopPropagation();
                    chat?.openChat(
                        {
                            conversationLabel: 'AI analizu fotografija',
                            gardenId,
                            raisedBedId,
                            positionIndex: positionIndex ?? null,
                            uiContext:
                                typeof positionIndex === 'number'
                                    ? { surface: 'plant-details', tab: 'diary' }
                                    : {
                                          surface: 'raised-bed-details',
                                          tab: 'diary',
                                      },
                            photoAnalysis: {
                                ...analysis,
                                gardenId,
                                key: JSON.stringify([
                                    gardenId,
                                    raisedBedId,
                                    positionIndex,
                                    analysis.imageUrls,
                                    analysis.referenceDate,
                                ]),
                                historyEntryId: latestCompleteHistoryEntry?.id,
                            },
                        },
                        event.currentTarget,
                    );
                }}
                startDecorator={
                    <Image
                        src={sunflowerMascotArtwork}
                        alt="Suncokret"
                        width={18}
                        height={18}
                    />
                }
            >
                {latestCompleteHistoryEntry
                    ? 'Pregledaj savjete suncokreta'
                    : 'Pitaj suncokret za savjete'}
            </ButtonGreen>
        </Stack>
    );
}
