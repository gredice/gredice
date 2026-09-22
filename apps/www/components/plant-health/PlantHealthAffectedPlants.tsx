import type { PlantPestData } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import { Add } from '@gredice/ui/icons';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { KnownPages } from '../../src/KnownPages';
import { CommunityEditButton } from '../community-edits/CommunityEditButton';
import { Card } from '../shared/Card';

export function PlantHealthAffectedPlants({
    plants,
    entityId,
    entityTypeName,
    publicPath,
}: {
    plants: PlantPestData['relationships']['affectedPlants'];
    entityId: number;
    entityTypeName: 'plantDisease' | 'plantPest';
    publicPath: string;
}) {
    return (
        <Stack spacing={3}>
            <Typography level="h2" className="text-2xl">
                Pogođene biljke
            </Typography>
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
                    label="Predloži pogođenu biljku"
                    trigger={
                        <Button
                            type="button"
                            variant="outlined"
                            color="neutral"
                            size="sm"
                            className="h-auto min-h-12 w-full justify-start gap-2 whitespace-normal rounded-lg border-dashed border-muted-foreground/40 bg-card/40 p-3 text-left font-normal hover:border-muted-foreground/60 hover:bg-card/70"
                            startDecorator={
                                <Add aria-hidden className="size-4 shrink-0" />
                            }
                        >
                            Predloži pogođenu biljku
                        </Button>
                    }
                />
            </div>
        </Stack>
    );
}
