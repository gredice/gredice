import type { PlantData } from '@gredice/client';
import { slug } from '@signalco/js';
import { cx } from '@signalco/ui-primitives/cx';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { ReactNode } from 'react';
import Markdown from 'react-markdown';
import { ExpandableText } from '../../../components/shared/ExpandableText';
import { FeedbackModal } from '../../../components/shared/feedback/FeedbackModal';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import {
    shouldMakeExpandable,
    splitContentForExpansion,
} from '../../../lib/content/expandableContent';
import { getOperationsData } from '../../../lib/plants/getOperationsData';
import { PlantOperations } from './PlantOperations';

export type InformationSectionProps = {
    plantId: number;
    id: string;
    header: string;
    content: string | null | undefined;
    sortContent?: string | null | undefined;
    operations?: PlantData['information']['operations'] | null | undefined;
    attributeCards?: ReactNode;
};

export async function InformationSection({
    plantId,
    id,
    header,
    content,
    sortContent,
    operations,
    attributeCards,
}: InformationSectionProps) {
    if (!content) {
        return null;
    }

    // Filter operations based on stage
    const allOperations = await getOperationsData();
    const gardenOperations = allOperations?.filter(
        (operation) =>
            operation.attributes?.application === 'garden' &&
            operation.attributes?.stage.information?.name === id,
    );
    const raisedBedFullOperations = allOperations?.filter(
        (operation) =>
            operation.attributes?.application === 'raisedBedFull' &&
            operation.attributes?.stage.information?.name === id,
    );
    const raisedBedSquareOperations = allOperations?.filter(
        (operation) =>
            operation.attributes?.application === 'raisedBed1m' &&
            operation.attributes?.stage.information?.name === id,
    );
    const plantOperations = operations?.filter(
        (operation) =>
            operation.attributes?.application === 'plant' &&
            operation.attributes?.stage.information?.name === id,
    );
    const applicableOperations = [
        ...(gardenOperations ?? []),
        ...(raisedBedFullOperations ?? []),
        ...(raisedBedSquareOperations ?? []),
        ...(plantOperations ?? []),
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 group">
            <Typography
                id={slug(header)}
                level="h2"
                className="text-2xl md:col-span-2"
            >
                {header}
            </Typography>
            <Stack spacing={1}>
                {sortContent && (
                    <Stack>
                        <Typography level="body2" className="-mb-2">
                            Specifično za ovu sortu:
                        </Typography>
                        {(() => {
                            const { mainContent, additionalContent } =
                                splitContentForExpansion(sortContent);
                            if (shouldMakeExpandable(sortContent)) {
                                return (
                                    <ExpandableText maxHeight={150}>
                                        <Markdown>{mainContent}</Markdown>
                                        {additionalContent && (
                                            <Markdown>
                                                {additionalContent}
                                            </Markdown>
                                        )}
                                    </ExpandableText>
                                );
                            }
                            return <Markdown>{sortContent}</Markdown>;
                        })()}
                    </Stack>
                )}
                <Stack>
                    {sortContent && (
                        <Typography level="body2" className="-mb-2">
                            Za biljku:
                        </Typography>
                    )}
                    {(() => {
                        const { mainContent, additionalContent } =
                            splitContentForExpansion(content);
                        if (shouldMakeExpandable(content)) {
                            return (
                                <ExpandableText maxHeight={150}>
                                    <Markdown>{mainContent}</Markdown>
                                    {additionalContent && (
                                        <Markdown>{additionalContent}</Markdown>
                                    )}
                                </ExpandableText>
                            );
                        }
                        return <Markdown>{content}</Markdown>;
                    })()}
                </Stack>
            </Stack>
            <Stack spacing={1}>
                {attributeCards}
                <Stack
                    className={cx(
                        'border rounded-lg p-2 h-fit',
                        !applicableOperations?.length && 'justify-center',
                    )}
                >
                    {(applicableOperations?.length ?? 0) <= 0 && (
                        <div className="py-4">
                            <NoDataPlaceholder>
                                Nema dodatnih radnji
                            </NoDataPlaceholder>
                        </div>
                    )}
                    {(applicableOperations?.length ?? 0) > 0 && (
                        <PlantOperations operations={applicableOperations} />
                    )}
                </Stack>
            </Stack>
            <FeedbackModal
                className="md:group-hover:opacity-100 md:opacity-0 transition-opacity ml-auto"
                topic="www/plants/information"
                data={{
                    plantId: plantId,
                    sectionId: id,
                }}
            />
        </div>
    );
}
