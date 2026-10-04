import { GardenPetCard } from '@apps/www/app/blokovi/ljubimci/GardenPetCard';
import { GardenPetsIntro } from '@apps/www/app/blokovi/ljubimci/GardenPetsIntro';
import { BrandLogo } from '@apps/www/app/sjeme/BrandLogo';
import logoExample from '@apps/www/assets/SeedsAndTransplants.webp';
import { PublicEmptyState } from '@apps/www/components/shared/placeholders/PublicEmptyState';
import { gardenPets } from '@apps/www/lib/pets/gardenPets';
import {
    GameBlocksIcon,
    GameGardenIcon,
    GameSeedlingIcon,
    GameSeedPacketIcon,
    GameTrophyIcon,
} from '@gredice/ui/GameIcons';
import { DirectorySearchResultVisual } from '@gredice/ui/PublicChrome';

const pet = gardenPets.find((candidate) => candidate.slug === 'pas');
const searchExamples = [
    { title: 'Biljka', entityType: 'plant' },
    { title: 'Sorta', entityType: 'plantSort' },
    { title: 'Bolest', entityType: 'plantDisease' },
    { title: 'Nametnik', entityType: 'plantPest' },
    { title: 'Sjeme', entityType: 'seed' },
    { title: 'Blok', entityType: 'block' },
    { title: 'Zalijevanje', entityType: 'operation', visualKey: 'watering' },
    {
        title: 'Nepoznata kategorija radnje',
        entityType: 'operation',
        visualKey: 'unknown',
    },
    { title: 'Drugi zapis', entityType: 'unknown' },
];
const emptyExamples = [
    {
        title: 'Biljke',
        Icon: GameSeedlingIcon,
        message: 'Nema rezultata pretrage.',
    },
    {
        title: 'Sjeme',
        Icon: GameSeedPacketIcon,
        message: 'Nema rezultata pretrage.',
    },
    {
        title: 'Blokovi',
        Icon: GameBlocksIcon,
        message: 'Nema rezultata pretrage.',
    },
    {
        title: 'Javni vrtovi',
        Icon: GameGardenIcon,
        message: 'Još nema javnih vrtova.',
    },
    {
        title: 'Postignuća',
        Icon: GameTrophyIcon,
        message: 'Još nema otključanih postignuća.',
    },
];

export function PublicCatalogVisualExamples() {
    const imageUrl =
        typeof logoExample === 'string' ? logoExample : logoExample.src;
    return (
        <div className="space-y-8">
            <section
                aria-label="Search artwork fallbacks"
                className="space-y-3"
            >
                <h2 className="text-xl font-semibold">
                    Pretraga · s fotografijom i bez nje
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {searchExamples.map(({ title, ...result }) => (
                        <div
                            key={title}
                            className="flex items-center gap-3 rounded-lg border p-3"
                        >
                            <DirectorySearchResultVisual result={result} />
                            <DirectorySearchResultVisual
                                result={result}
                                imageSize={56}
                                className="size-14"
                                iconClassName="size-8"
                            />
                            <span>{title}</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                        <DirectorySearchResultVisual
                            result={{
                                entityType: 'seed',
                                imageUrl,
                                imageAlt: 'Primjer priložene slike',
                            }}
                        />
                        <span>Priložena slika ima prednost</span>
                    </div>
                </div>
            </section>
            <section aria-label="Pet care artwork" className="space-y-3">
                <h2 className="text-xl font-semibold">
                    Ljubimci · dom, navike i vrijeme
                </h2>
                <GardenPetsIntro />
                {pet && (
                    <GardenPetCard
                        pet={pet}
                        home={{
                            alias: 'dog-house',
                            label: 'Kućica za psa',
                            sunflowers: 2000,
                        }}
                    />
                )}
            </section>
            <section aria-label="Brand logo fallbacks" className="space-y-3">
                <h2 className="text-xl font-semibold">
                    Proizvođači · zamjenska ilustracija
                </h2>
                <div className="flex flex-wrap items-center gap-4">
                    <div className="size-48 overflow-hidden rounded-lg border">
                        <BrandLogo
                            brand={{
                                information: { name: 'Vrtna Sjemenarna' },
                            }}
                        />
                    </div>
                    <div className="size-24 overflow-hidden rounded-lg border">
                        <BrandLogo
                            brand={{ information: { name: 'Mali Vrt' } }}
                        />
                    </div>
                    <div className="size-48 overflow-hidden rounded-lg border">
                        <BrandLogo
                            brand={{
                                information: {
                                    name: 'Primjer sa slikom',
                                    logo: { url: imageUrl },
                                },
                            }}
                        />
                    </div>
                </div>
            </section>
            <section
                aria-label="Illustrated empty collections"
                className="space-y-3"
            >
                <h2 className="text-xl font-semibold">Prazne kolekcije</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {emptyExamples.map(({ title, Icon, message }) => (
                        <section
                            key={title}
                            aria-label={title}
                            className="rounded-lg border p-3"
                        >
                            <h3 className="text-center font-medium">{title}</h3>
                            <PublicEmptyState icon={Icon}>
                                {message}
                            </PublicEmptyState>
                        </section>
                    ))}
                </div>
            </section>
        </div>
    );
}
