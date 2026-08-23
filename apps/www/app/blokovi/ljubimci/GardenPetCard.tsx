import { BlockImage } from '@gredice/ui/BlockImage';
import { Card, CardContent } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Cloud, Home, Moon, PawPrint, Sun } from '@gredice/ui/icons';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { GardenPet } from '../../../lib/pets/gardenPets';
import { KnownPages } from '../../../src/KnownPages';
import { GardenPetRoutine } from './GardenPetRoutine';

type GardenPetHome = {
    alias: string;
    label: string;
    sunflowers: number | null;
};

// Formatted without `toLocaleString` so the server and client markup match.
function formatBlockDistance(blocks: number) {
    return blocks.toString().replace('.', ',');
}

export function GardenPetCard({
    home,
    pet,
}: {
    home: GardenPetHome | null;
    pet: GardenPet;
}) {
    return (
        <Card className="scroll-mt-24 border-tertiary border-b-4" id={pet.slug}>
            <CardContent
                className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]"
                noHeader
            >
                <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted/40">
                    <BlockImage
                        alt={
                            pet.directlyPlaceable
                                ? `${pet.name} u 3D vrtu`
                                : `Dom ${pet.genitive} u 3D vrtu`
                        }
                        blockName={pet.homeBlockName}
                        fill
                        sizes="(max-width: 768px) 100vw, 224px"
                    />
                </div>
                <Stack spacing={4}>
                    <Stack spacing={2}>
                        <Row spacing={2}>
                            <Typography component="h2" level="h4">
                                {pet.name}
                            </Typography>
                            <Chip color="neutral" size="sm" variant="soft">
                                {pet.sound}
                            </Chip>
                        </Row>
                        <Typography level="body1" secondary>
                            {pet.fullDescription}
                        </Typography>
                    </Stack>
                    <Stack spacing={1}>
                        <Typography component="h3" level="body2" semiBold>
                            Navike
                        </Typography>
                        <ul className="flex flex-col gap-1">
                            {pet.habits.map((habit) => (
                                <li
                                    className="flex flex-row items-start gap-2"
                                    key={habit}
                                >
                                    <PawPrint
                                        aria-hidden
                                        className="mt-1 size-4 shrink-0 text-muted-foreground"
                                    />
                                    <Typography level="body2">
                                        {habit}
                                    </Typography>
                                </li>
                            ))}
                        </ul>
                    </Stack>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <GardenPetRoutine
                            icon={<Sun aria-hidden className="size-4" />}
                            label="Danju"
                            value={`Obilazi vrt u krugu do ${formatBlockDistance(pet.dayRangeBlocks)} blokova od doma.`}
                        />
                        <GardenPetRoutine
                            icon={<Moon aria-hidden className="size-4" />}
                            label="Noću"
                            value={pet.nightRoutine}
                        />
                        <GardenPetRoutine
                            icon={<Cloud aria-hidden className="size-4" />}
                            label="Po lošem vremenu"
                            value={pet.weatherRoutine}
                        />
                    </div>
                    {home ? (
                        <Stack spacing={2}>
                            <Row alignItems="start" spacing={2}>
                                <Home
                                    aria-hidden
                                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                />
                                <Typography level="body2">
                                    {pet.directlyPlaceable
                                        ? 'U vrt ga postavljaš izravno blokom '
                                        : 'U vrt stiže s blokom '}
                                    <span className="font-semibold">
                                        {home.label}
                                    </span>
                                    {(home.sunflowers ?? 0) > 0
                                        ? ` (🌻 ${home.sunflowers})`
                                        : ''}
                                    .
                                </Typography>
                            </Row>
                            <Row>
                                <NavigatingButton
                                    href={KnownPages.Block(home.alias)}
                                    variant="soft"
                                >
                                    Pogledaj blok
                                </NavigatingButton>
                            </Row>
                        </Stack>
                    ) : (
                        <Row alignItems="start" spacing={2}>
                            <Home
                                aria-hidden
                                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                            />
                            <Typography level="body2" secondary>
                                Blok koji dovodi ovog ljubimca uskoro stiže u
                                katalog.
                            </Typography>
                        </Row>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}
