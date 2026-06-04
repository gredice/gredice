import type { OperationData, PlantData } from '@gredice/client';
import { slug } from '@gredice/js/slug';
import { Markdown } from '@gredice/ui/Markdown';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';
import { CommunityEditButton } from '../../../components/community-edits/CommunityEditButton';
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
    editEntityTypeName?: 'plant' | 'plantSort';
    editEntityId?: number;
    editPublicPath?: string;
    editSectionKey?: string;
};

function isPublicOperation(operation: Pick<OperationData, 'attributes'>) {
    return operation.attributes?.internal !== true;
}

export async function InformationSection({
    plantId,
    id,
    header,
    content,
    sortContent,
    operations,
    attributeCards,
    editEntityTypeName,
    editEntityId,
    editPublicPath,
    editSectionKey = id,
}: InformationSectionProps) {
    const hasContent = Boolean(content?.trim());
    const hasSortContent = Boolean(sortContent?.trim());
    const hasTextContent = hasContent || hasSortContent;

    if (!hasTextContent && !attributeCards) {
        return null;
    }

    // Filter operations based on stage
    const allOperations = (await getOperationsData()).filter(isPublicOperation);
    const gardenOperations = allOperations.filter(
        (operation) =>
            operation.attributes?.application === 'garden' &&
            operation.attributes?.stage.information?.name === id,
    );
    const raisedBedFullOperations = allOperations.filter(
        (operation) =>
            operation.attributes?.application === 'raisedBedFull' &&
            operation.attributes?.stage.information?.name === id,
    );
    const raisedBedSquareOperations = allOperations.filter(
        (operation) =>
            operation.attributes?.application === 'raisedBed1m' &&
            operation.attributes?.stage.information?.name === id,
    );
    const plantOperations = operations?.filter(
        (operation) =>
            isPublicOperation(operation) &&
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
        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 group">
            <div className="absolute -inset-4 border border-transparent rounded-2xl group-hover:border-border pointer-events-none group-focus-within:border-border"></div>
            <Typography
                id={slug(header)}
                level="h2"
                className="text-2xl md:col-span-2"
            >
                {header}
            </Typography>
            <Stack spacing={2}>
                {hasTextContent ? (
                    <>
                        {hasSortContent && sortContent && (
                            <Stack>
                                <Typography level="body2" className="-mb-2">
                                    Specifično za ovu sortu:
                                </Typography>
                                {(() => {
                                    const { mainContent, additionalContent } =
                                        splitContentForExpansion(sortContent);
                                    if (shouldMakeExpandable(sortContent)) {
                                        return (
                                            <ExpandableText maxHeight={240}>
                                                <Markdown>
                                                    {mainContent}
                                                </Markdown>
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
                        {hasContent && content && (
                            <Stack>
                                {hasSortContent && (
                                    <Typography level="body2" className="-mb-2">
                                        Za biljku:
                                    </Typography>
                                )}
                                {(() => {
                                    const { mainContent, additionalContent } =
                                        splitContentForExpansion(content);
                                    if (shouldMakeExpandable(content)) {
                                        return (
                                            <ExpandableText maxHeight={240}>
                                                <Markdown>
                                                    {mainContent}
                                                </Markdown>
                                                {additionalContent && (
                                                    <Markdown>
                                                        {additionalContent}
                                                    </Markdown>
                                                )}
                                            </ExpandableText>
                                        );
                                    }
                                    return <Markdown>{content}</Markdown>;
                                })()}
                            </Stack>
                        )}
                    </>
                ) : (
                    <div className="py-4">
                        <NoDataPlaceholder>
                            Trenutno nema dodatnih savjeta
                        </NoDataPlaceholder>
                    </div>
                )}
            </Stack>
            <Stack spacing={2}>
                {attributeCards}
                <Stack
                    className={cx(
                        'relative border rounded-lg px-2 pb-2 pt-3 h-fit',
                        !applicableOperations?.length && 'justify-center',
                    )}
                >
                    <Typography
                        level="body3"
                        component="span"
                        semiBold
                        uppercase
                        className="absolute -top-2 left-3 bg-background px-1 leading-none"
                    >
                        RADNJE
                    </Typography>
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
            <div className="ml-auto flex items-center gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                {editEntityTypeName && editEntityId && editPublicPath ? (
                    <CommunityEditButton
                        entityTypeName={editEntityTypeName}
                        entityId={editEntityId}
                        publicPath={editPublicPath}
                        sectionKey={editSectionKey}
                    />
                ) : null}
                <FeedbackModal
                    topic="www/plants/information"
                    data={{
                        plantId: plantId,
                        sectionId: id,
                    }}
                />
            </div>
        </div>
    );
}
