import { PageHeader } from '@gredice/ui/PageHeader';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { FeedbackModal } from '../../../components/shared/feedback/FeedbackModal';
import { PublicBreadcrumbs } from '../../../components/shared/seo/PublicBreadcrumbs';
import { StructuredDataScript } from '../../../components/shared/seo/StructuredDataScript';
import { getBlocksData } from '../../../lib/blocks/getBlocksData';
import { resolveGardenPetHomeBlocks } from '../../../lib/pets/gardenPetHomeBlocks';
import {
    createPublicMetadata,
    PUBLIC_SITE_ORIGIN,
} from '../../../lib/seo/publicMetadata';
import { KnownPages } from '../../../src/KnownPages';
import { GardenPetCard } from './GardenPetCard';
import { GardenPetsIntro } from './GardenPetsIntro';
import { OtherGardenResidents } from './OtherGardenResidents';

const pageDescription =
    'Svaki ljubimac stiže u vrt sa svojim domom ili sigurnim početnim mjestom, a zatim sam istražuje okolicu i brine se za svoj dan.';

export const revalidate = 43200; // 12 hours

export const metadata: Metadata = createPublicMetadata({
    title: 'Ljubimci',
    description: pageDescription,
    path: KnownPages.BlockPets,
    category: '3D vrt',
});

export default async function GardenPetsPage() {
    const blocks = await getBlocksData();
    const pets = resolveGardenPetHomeBlocks(blocks);

    return (
        <Stack spacing={8} className="py-6 sm:py-8">
            <StructuredDataScript
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'ItemList',
                    name: 'Ljubimci u vrtu',
                    description: pageDescription,
                    url: `${PUBLIC_SITE_ORIGIN}${KnownPages.BlockPets}`,
                    itemListElement: pets.map(({ pet }, index) => ({
                        '@type': 'ListItem',
                        position: index + 1,
                        item: {
                            '@type': 'Thing',
                            name: pet.name,
                            description: pet.shortDescription,
                            url: `${PUBLIC_SITE_ORIGIN}${KnownPages.BlockPets}#${pet.slug}`,
                        },
                    })),
                }}
            />
            <Stack spacing={6}>
                <PublicBreadcrumbs
                    items={[
                        { label: 'Blokovi', href: KnownPages.Blocks },
                        { label: 'Ljubimci' },
                    ]}
                />
                <PageHeader header="Ljubimci" subHeader={pageDescription} />
                <GardenPetsIntro />
            </Stack>
            <Stack spacing={4}>
                {pets.map(({ homeBlock, homeBlockAlias, pet }) => (
                    <GardenPetCard
                        home={
                            homeBlock && homeBlockAlias
                                ? {
                                      alias: homeBlockAlias,
                                      label: homeBlock.information.label,
                                      sunflowers:
                                          homeBlock.prices?.sunflowers ?? null,
                                  }
                                : null
                        }
                        key={pet.slug}
                        pet={pet}
                    />
                ))}
            </Stack>
            <OtherGardenResidents />
            <Row spacing={4}>
                <Typography level="body1">
                    Jesu li ti informacije korisne?
                </Typography>
                <FeedbackModal topic="www/blocks/pets" />
            </Row>
        </Stack>
    );
}
