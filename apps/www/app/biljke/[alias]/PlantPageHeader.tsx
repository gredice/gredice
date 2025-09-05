import type { PlantData, PlantSortData } from '@gredice/client';
import { AiWatermark } from '@gredice/ui/AiWatermark';
import { SeedTimeInformationBadge } from '@gredice/ui/plants';
import { slug } from '@signalco/js';
import { NavigatingButton } from '@signalco/ui/NavigatingButton';
import { Euro, LayoutGrid, MapPinHouse } from '@signalco/ui-icons';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { AttributeCard } from '../../../components/attributes/DetailCard';
import { PlantImage } from '../../../components/plants/PlantImage';
import { FeedbackModal } from '../../../components/shared/feedback/FeedbackModal';
import { PageHeader } from '../../../components/shared/PageHeader';
import { KnownPages } from '../../../src/KnownPages';
import { getPlantInforationSections } from './getPlantInforationSections';
import { PlantAttributeCards } from './PlantAttributeCards';
import { PlantCalendarPicker } from './PlantCalendarPicker';
import { VerifiedInformationBadge } from './VerifiedInformationBadge';

export function PlantPageHeader({
    plant,
    sort,
}: {
    plant: PlantData & { isRecommended: boolean | null | undefined };
    sort?: PlantSortData;
}) {
    const informationSections = getPlantInforationSections(plant);
    let plantsPerRow = Math.floor(
        30 / (plant.attributes?.seedingDistance ?? 30),
    );
    if (plantsPerRow < 1) {
        console.warn(
            `Plants per row is less than 1 (${plantsPerRow}) for ${plant.information.name}. Setting to 1.`,
        );
        plantsPerRow = 1;
    }
    const totalPlants = Math.floor(plantsPerRow * plantsPerRow);

    const baseLatinName = plant.information.latinName
        ? `lat. ${plant.information.latinName}`
        : null;
    const sortLatinName = `lat. ${sort?.information.latinName ?? '-'}`;
    return (
        <PageHeader
            visual={
                <AiWatermark
                    reason="Primjer ploda biljke visoke rezolucije bez nedostataka."
                    aiPrompt={`Realistic and not perfect image of requested plant on white background. No Text Or Banners. Square image. ${plant.information.name}`}
                    aiModel="ChatGPT-4o"
                >
                    <PlantImage
                        plant={{
                            information: {
                                name:
                                    sort?.information?.name ??
                                    plant.information.name,
                            },
                            image: {
                                cover: sort?.image?.cover ?? plant.image?.cover,
                            },
                        }}
                        priority
                        width={142}
                        height={142}
                    />
                </AiWatermark>
            }
            header={sort?.information?.name ?? plant.information.name}
            alternativeName={
                sort ? (
                    <Stack>
                        <Typography level="body2" secondary>
                            Sorta: {sortLatinName}
                        </Typography>
                        <Typography level="body2" secondary>
                            Biljka: {baseLatinName}
                        </Typography>
                    </Stack>
                ) : (
                    baseLatinName
                )
            }
            subHeader={
                sort?.information.description ?? plant.information.description
            }
            headerChildren={
                <Stack spacing={4} alignItems="start">
                    {(plant.information.origin || sort?.information.origin) && (
                        <Stack spacing={1}>
                            <Typography level="body2">Porijeklo</Typography>
                            <Row spacing={1}>
                                <MapPinHouse className="size-5 shrink-0" />
                                <Typography>
                                    {sort?.information.origin ??
                                        plant.information.origin}
                                </Typography>
                            </Row>
                        </Stack>
                    )}
                    <Row spacing={1}>
                        {plant.information.verified && (
                            <VerifiedInformationBadge />
                        )}
                        {plant.isRecommended && <SeedTimeInformationBadge />}
                    </Row>
                    {informationSections.some(
                        (section) => section.avaialble,
                    ) && (
                        <Stack spacing={1}>
                            <Typography level="body2">Sadržaj</Typography>
                            <Row spacing={1} className="flex-wrap">
                                {informationSections
                                    .filter((section) => section.avaialble)
                                    .map((section) => (
                                        <Chip
                                            key={section.id}
                                            color="neutral"
                                            href={`#${slug(section.header)}`}
                                        >
                                            {section.header}
                                        </Chip>
                                    ))}
                            </Row>
                        </Stack>
                    )}
                    <NavigatingButton
                        href={KnownPages.GardenApp}
                        className="bg-green-800 hover:bg-green-700"
                    >
                        Moj vrt
                    </NavigatingButton>
                </Stack>
            }
        >
            <Stack>
                <PlantCalendarPicker plant={plant} sort={sort} />
                <Stack spacing={1} className="group">
                    <Typography level="h5" component="h2">
                        Informacije
                    </Typography>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <AttributeCard
                            icon={<LayoutGrid />}
                            header="Broj biljaka na 30x30 cm"
                            value={totalPlants.toString()}
                            description="Podignutim gredica podjeljena je na polja veličine 30x30 cm. Tako podignuta gredica od 2x1m ima 18 polja za sadnju tvojih biljaka. U svako polje može stati određeni broj biljaka, ovisno o vrsti odnosno o razmaku sijanje/sadnje biljke."
                            navigateHref={KnownPages.RaisedBeds}
                            navigateLabel="Više o gredicama"
                        />
                        {plant.prices?.perPlant && (
                            <AttributeCard
                                icon={<Euro />}
                                header="Cijena za sadnju"
                                value={`${plant.prices.perPlant.toFixed(2)}€`}
                            />
                        )}
                    </div>
                    <FeedbackModal
                        topic={
                            sort
                                ? 'www/plants/sorts/information'
                                : 'www/plants/information'
                        }
                        data={{
                            plantId: plant.id,
                            plantAlias: plant.information.name,
                            sortId: sort?.id,
                            sortAlias: sort?.information.name,
                        }}
                        className="self-end group-hover:opacity-100 opacity-0 transition-opacity"
                    />
                </Stack>
                <Stack spacing={1} className="group">
                    <Typography level="h5" component="h2">
                        Svojstva
                    </Typography>
                    <PlantAttributeCards attributes={plant.attributes} />
                    <FeedbackModal
                        topic={
                            sort
                                ? 'www/plants/sorts/attributes'
                                : 'www/plants/attributes'
                        }
                        data={{
                            plantId: plant.id,
                            plantAlias: plant.information.name,
                            sortId: sort?.id,
                            sortAlias: sort?.information.name,
                        }}
                        className="self-end group-hover:opacity-100 opacity-0 transition-opacity"
                    />
                </Stack>
            </Stack>
        </PageHeader>
    );
}
