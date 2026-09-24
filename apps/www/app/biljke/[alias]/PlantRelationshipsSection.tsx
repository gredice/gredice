import type { PlantData } from '@gredice/client';
import { slug } from '@gredice/js/slug';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { CommunityEditButton } from '../../../components/community-edits/CommunityEditButton';
import { Card } from '../../../components/shared/Card';
import { KnownPages } from '../../../src/KnownPages';

type PlantRelationship = NonNullable<
    NonNullable<PlantData['relationships']>['companions']
>[number];

export type PlantRelationships = PlantData['relationships'];

type PlantRelationshipEditTarget = {
    entityTypeName: 'plant' | 'plantSort';
    entityId: number;
    publicPath: string;
};

export function hasPlantRelationships(
    relationships: PlantRelationships | null | undefined,
) {
    return (
        (relationships?.companions?.length ?? 0) > 0 ||
        (relationships?.antagonists?.length ?? 0) > 0
    );
}

function PlantRelationshipCard({
    relationship,
    borderClassName,
}: {
    relationship: PlantRelationship;
    borderClassName: string;
}) {
    return (
        <Card
            href={KnownPages.Plant(relationship.slug || relationship.name)}
            className={`border-b-4 ${borderClassName}`}
        >
            <Row spacing={3} className="items-center">
                <PlantOrSortImage
                    plant={{
                        image: relationship.image,
                        information: { name: relationship.name },
                    }}
                    width={56}
                    height={56}
                    className="rounded-md object-cover"
                />
                <Stack spacing={0} className="min-w-0">
                    <Typography level="h5" className="truncate leading-tight">
                        {relationship.name}
                    </Typography>
                    {relationship.latinName && (
                        <Typography
                            level="body2"
                            className="text-secondary-foreground italic truncate leading-tight"
                        >
                            {relationship.latinName}
                        </Typography>
                    )}
                </Stack>
            </Row>
        </Card>
    );
}

function PlantRelationshipGroup({
    title,
    description,
    relationships,
    borderClassName,
    editTarget,
    fieldName,
    emptyMessage,
    suggestionLabel,
}: {
    title: string;
    description: string;
    relationships: PlantRelationship[] | undefined;
    borderClassName: string;
    editTarget?: PlantRelationshipEditTarget;
    fieldName: 'companions' | 'antagonists';
    emptyMessage: string;
    suggestionLabel: string;
}) {
    return (
        <Stack spacing={3}>
            <Stack spacing={1}>
                <Typography level="h2" className="text-xl">
                    {title}
                </Typography>
                <Typography level="body2" secondary>
                    {description}
                </Typography>
            </Stack>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {relationships?.map((relationship) => (
                    <PlantRelationshipCard
                        key={relationship.id}
                        relationship={relationship}
                        borderClassName={borderClassName}
                    />
                ))}
                {!relationships?.length ? (
                    <Typography
                        level="body2"
                        secondary
                        className="col-span-full"
                    >
                        {emptyMessage}
                    </Typography>
                ) : null}
                {editTarget ? (
                    <CommunityEditButton
                        entityTypeName={editTarget.entityTypeName}
                        entityId={editTarget.entityId}
                        publicPath={editTarget.publicPath}
                        sectionKey="relationships"
                        fieldKey={`${editTarget.entityTypeName === 'plantSort' ? 'plant-sort' : 'plant'}.relationships.${fieldName}`}
                        label={suggestionLabel}
                        buttonStyle="card"
                    />
                ) : null}
            </div>
        </Stack>
    );
}

export function PlantRelationshipsSection({
    editTarget,
    relationships,
}: {
    editTarget?: PlantRelationshipEditTarget;
    relationships: PlantRelationships | null | undefined;
}) {
    return (
        <Stack spacing={4} id={slug('Biljni susjedi')}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <PlantRelationshipGroup
                    title="Dobri susjedi"
                    description="Biljke koje se dobro slažu u blizini ove biljke."
                    relationships={relationships?.companions}
                    borderClassName="border-emerald-500"
                    editTarget={editTarget}
                    fieldName="companions"
                    emptyMessage="Još nema predloženih dobrih susjeda."
                    suggestionLabel="Predloži dobrog susjeda"
                />
                <PlantRelationshipGroup
                    title="Izbjegavati blizinu"
                    description="Biljke koje je bolje saditi odvojeno od ove biljke."
                    relationships={relationships?.antagonists}
                    borderClassName="border-amber-500"
                    editTarget={editTarget}
                    fieldName="antagonists"
                    emptyMessage="Još nema biljaka koje je bolje saditi odvojeno."
                    suggestionLabel="Predloži lošeg susjeda"
                />
            </div>
        </Stack>
    );
}
