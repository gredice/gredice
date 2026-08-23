import { Card, CardContent } from '@gredice/ui/Card';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { GardenPet } from '../../lib/pets/gardenPets';
import { KnownPages } from '../../src/KnownPages';
import { GardenPetLink } from './GardenPetLink';

export function GardenPetsHighlight({ pets }: { pets: readonly GardenPet[] }) {
    return (
        <Card className="border-tertiary border-b-4">
            <CardContent noHeader>
                <Stack spacing={4}>
                    <Row
                        alignItems="start"
                        justifyContent="space-between"
                        spacing={2}
                    >
                        <Stack spacing={1}>
                            <Typography component="h2" level="h5">
                                Ljubimci
                            </Typography>
                            <Typography level="body2" secondary>
                                Postavi njihov blok i dosele se u vrt.
                            </Typography>
                        </Stack>
                        <NavigatingButton
                            className="shrink-0"
                            href={KnownPages.BlockPets}
                            size="sm"
                            variant="plain"
                        >
                            Saznaj više
                        </NavigatingButton>
                    </Row>
                    <div className="flex flex-row flex-wrap justify-center gap-2 sm:justify-start sm:gap-6">
                        {pets.map((pet) => (
                            <GardenPetLink key={pet.slug} pet={pet} />
                        ))}
                    </div>
                </Stack>
            </CardContent>
        </Card>
    );
}
