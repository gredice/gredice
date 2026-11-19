import type { PlantPestData } from '@gredice/client';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { KnownPages } from '../../src/KnownPages';
import { CommunityEditButton } from '../community-edits/CommunityEditButton';
import type { CommunityContributorView } from '../community-edits/communityContributors';
import { SectionContributors } from '../community-edits/SectionContributors';
import { Card } from '../shared/Card';

export function PlantHealthAffectedPlants({
    contributors = [],
    plants,
    entityId,
    entityName,
    entityTypeName,
    publicPath,
}: {
    /** Gardeners whose accepted suggestions linked plants here. */
    contributors?: readonly CommunityContributorView[];
    plants: PlantPestData['relationships']['affectedPlants'];
    entityId: number;
    /** Public name of the disease or pest, shown in the edit dialog. */
    entityName?: string;
    entityTypeName: 'plantDisease' | 'plantPest';
    publicPath: string;
}) {
    return (
        <Stack spacing={3}>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <Typography level="h2" className="text-2xl">
                    Pogođene biljke
                </Typography>
                <SectionContributors contributors={contributors} />
            </div>
            {plants.length === 0 && (
                <Typography level="body2" secondary>
                    Trenutno nema navedenih pogođenih biljaka.
                </Typography>
            )}
            <div className="grid grid-cols-1 gap-2">
                {plants.map((plant) => (
                    <Link
                        key={plant.id}
                        href={KnownPages.Plant(plant.slug || plant.name)}
                        className="group min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                        <Card className="p-3 transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                            <Row spacing={3} alignItems="center">
                                <PlantOrSortImage
                                    plant={{
                                        image: plant.image,
                                        information: { name: plant.name },
                                    }}
                                    width={48}
                                    height={48}
                                    className="shrink-0 rounded-md object-cover"
                                />
                                <Stack spacing={0} className="min-w-0">
                                    <Typography className="truncate">
                                        {plant.name}
                                    </Typography>
                                    {plant.latinName && (
                                        <Typography
                                            level="body3"
                                            secondary
                                            className="truncate italic"
                                        >
                                            {plant.latinName}
                                        </Typography>
                                    )}
                                </Stack>
                            </Row>
                        </Card>
                    </Link>
                ))}
                <CommunityEditButton
                    entityId={entityId}
                    entityTypeName={entityTypeName}
                    publicPath={publicPath}
                    sectionKey="relationships"
                    entityName={entityName}
                    sectionLabel="Pogođene biljke"
                    label="Predloži pogođenu biljku"
                    buttonStyle="card"
                />
            </div>
        </Stack>
    );
}
