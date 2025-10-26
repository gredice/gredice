import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FeedbackModal } from '../../../components/shared/feedback/FeedbackModal';
import { getPlantsData } from '../../../lib/plants/getPlantsData';
import { KnownPages } from '../../../src/KnownPages';
import { GrowthAttributeCards } from './GrowthAttributeCards';
import { getPlantInforationSections } from './getPlantInforationSections';
import { HarvestAttributeCards } from './HarvestAttributeCards';
import { InformationSection } from './InformationSection';
import { PlantPageHeader } from './PlantPageHeader';
import { PlantSortsList } from './PlantSortsList';
import { PlantTips } from './PlantTips';
import { SowingAttributeCards } from './SowingAttributeCards';
import { WateringAttributeCards } from './WateringAttributeCards';

export const revalidate = 3600; // 1 hour
export async function generateMetadata(
    props: PageProps<'/biljke/[alias]'>,
): Promise<Metadata> {
    const { alias: aliasUnescaped } = await props.params;
    const alias = aliasUnescaped ? decodeURIComponent(aliasUnescaped) : null;
    const plant = (await getPlantsData())?.find(
        (plant) =>
            plant.information.name.toLowerCase() === alias?.toLowerCase(),
    );
    if (!plant) {
        return {
            title: 'Biljka nije pronađena',
            description: 'Biljka nije pronađena',
        };
    }
    return {
        title: plant.information.name,
        description: plant.information.description,
    };
}

export async function generateStaticParams() {
    const plants = await getPlantsData();
    return (
        plants?.map((entity) => ({
            alias: String(entity.information.name),
        })) ?? []
    );
}

export default async function PlantPage(props: PageProps<'/biljke/[alias]'>) {
    const { alias: aliasUnescaped } = await props.params;
    const alias = aliasUnescaped ? decodeURIComponent(aliasUnescaped) : null;
    if (!alias) {
        notFound();
    }

    const plant = (await getPlantsData())?.find(
        (plant) => plant.information.name.toLowerCase() === alias.toLowerCase(),
    );
    if (!plant) {
        notFound();
    }

    const informationSections = getPlantInforationSections(plant);

    // Map section IDs to their corresponding attribute cards
    const getAttributeCardsForSection = (sectionId: string) => {
        switch (sectionId) {
            case 'sowing':
                return <SowingAttributeCards attributes={plant.attributes} />;
            case 'growth':
                return <GrowthAttributeCards attributes={plant.attributes} />;
            case 'watering':
                return <WateringAttributeCards attributes={plant.attributes} />;
            case 'harvest':
                return <HarvestAttributeCards attributes={plant.attributes} />;
            default:
                return undefined;
        }
    };

    return (
        <div className="py-8">
            <Stack spacing={4}>
                <Breadcrumbs
                    items={[
                        { label: 'Biljke', href: KnownPages.Plants },
                        { label: plant.information.name },
                    ]}
                />
                <PlantPageHeader plant={plant} />
                {informationSections
                    .filter((section) => section.avaialble)
                    .map((section) => (
                        <InformationSection
                            key={section.id}
                            id={section.id}
                            plantId={plant.id}
                            header={section.header}
                            content={plant.information[section.id]}
                            operations={plant.information.operations}
                            attributeCards={getAttributeCardsForSection(
                                section.id,
                            )}
                        />
                    ))}
                <PlantSortsList basePlantName={plant.information.name} />
                {(plant.information.tip?.length ?? 0) > 0 && (
                    <PlantTips plant={plant} />
                )}
                <Typography level="body1" component="p">
                    Želiš saznati više o tome kako naručiti sjetvu? Posjeti našu
                    stranicu o{' '}
                    <Link className="underline" href={KnownPages.Sowing}>
                        sjetvi biljaka
                    </Link>{' '}
                    za detalje o sjetvi, rasporedu i pogodnostima.
                </Typography>
                <Row spacing={2}>
                    <Typography level="body1">
                        Jesu li ti informacije o ovoj biljci korisne?
                    </Typography>
                    <FeedbackModal
                        topic="www/plants/details"
                        data={{
                            plantId: plant.id,
                            plantAlias: alias,
                        }}
                    />
                </Row>
            </Stack>
        </div>
    );
}
