import type { PlantData, PlantSortData } from '@gredice/client';
import { calculatePlantsPerField, FIELD_SIZE_LABEL } from '@gredice/js/plants';
import { slug } from '@gredice/js/slug';
import { Chip } from '@gredice/ui/Chip';
import { PlantGridIcon } from '@gredice/ui/GridIcons';
import { MapPinHouse, Sprout } from '@gredice/ui/icons';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { PageHeader } from '@gredice/ui/PageHeader';
import { PlantOrSortImage, SeedTimeInformationBadge } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { AttributeCard } from '../../../components/attributes/DetailCard';
import { PriceAttributeCard } from '../../../components/attributes/PriceAttributeCard';
import { CommunityEditButton } from '../../../components/community-edits/CommunityEditButton';
import { FeedbackModal } from '../../../components/shared/feedback/FeedbackModal';
import { KnownPages } from '../../../src/KnownPages';
import { getPlantImageViewTransitionName } from '../plantViewTransition';
import { getPlantInforationSections } from './getPlantInforationSections';
import { PlantCalendarPicker } from './PlantCalendarPicker';
import { hasPlantHealth } from './PlantHealthSection';
import { hasPlantRelationships } from './PlantRelationshipsSection';
import { VerifiedInformationBadge } from './VerifiedInformationBadge';

type InformationWithAlternativeName = {
    name?: unknown;
    alternativeName?: unknown;
};
type PlantSortWithRelationships = PlantSortData & {
    relationships?: PlantData['relationships'];
};

type OverviewEditTarget = {
    entityTypeName: 'plant' | 'plantSort';
    entityId: number;
    publicPath: string;
};

const alternativeNamesLocale = 'hr-HR';

function formatAlternativeNames(
    information: InformationWithAlternativeName | null | undefined,
) {
    const names = Array.isArray(information?.alternativeName)
        ? information.alternativeName
              .filter((name): name is string => typeof name === 'string')
              .map((name) => name.trim())
              .filter(Boolean)
        : [];

    return names
        .map((name, index) => {
            const lowerName = name.toLocaleLowerCase(alternativeNamesLocale);
            if (index > 0) {
                return lowerName;
            }

            const [firstLetter, ...rest] = Array.from(lowerName);
            return firstLetter
                ? `${firstLetter.toLocaleUpperCase(alternativeNamesLocale)}${rest.join('')}`
                : lowerName;
        })
        .join(', ');
}

export function PlantPageHeader({
    overviewEditTarget,
    plant,
    sort,
}: {
    overviewEditTarget?: OverviewEditTarget;
    plant: PlantData & { isRecommended: boolean | null | undefined };
    sort?: PlantSortWithRelationships;
}) {
    const informationSections = getPlantInforationSections(plant, sort);
    const { totalPlants } = calculatePlantsPerField(
        plant.attributes?.seedingDistance,
    );
    const contentLinks = informationSections
        .filter((section) => section.avaialble)
        .map((section) => ({
            href: `#${slug(section.header)}`,
            label: section.header,
        }));
    if ((plant.information.tip?.length ?? 0) > 0) {
        contentLinks.push({
            href: `#${slug('Savjeti')}`,
            label: 'Savjeti',
        });
    }
    if (hasPlantHealth(plant.health)) {
        contentLinks.push({
            href: `#${slug('Zdravlje biljke')}`,
            label: 'Zdravlje biljke',
        });
    }
    if (hasPlantRelationships(sort?.relationships ?? plant.relationships)) {
        contentLinks.push({
            href: `#${slug('Biljni susjedi')}`,
            label: 'Biljni susjedi',
        });
    }
    if (!sort) {
        contentLinks.push({
            href: `#${slug('Sorte')}`,
            label: 'Sorte',
        });
    }

    const baseLatinName = plant.information.latinName
        ? `lat. ${plant.information.latinName}`
        : null;
    const sortLatinName = `lat. ${sort?.information.latinName ?? '-'}`;
    const origin = sort?.information.origin ?? plant.information.origin;
    const alternativeNames =
        formatAlternativeNames(sort?.information) ||
        formatAlternativeNames(plant.information);
    const plantPrice = plant.prices?.perPlant;
    const price =
        typeof plantPrice === 'number'
            ? {
                  currentPrice: plantPrice,
                  entityId: plant.id,
                  entityTypeName: 'plant' as const,
              }
            : null;

    return (
        <PageHeader
            visual={
                sort ? (
                    <span
                        className="public-content-card-view-transition inline-flex size-48 items-center justify-center overflow-hidden"
                        style={{
                            viewTransitionName: getPlantImageViewTransitionName(
                                plant.id,
                            ),
                        }}
                    >
                        <PlantOrSortImage
                            plantSort={sort}
                            preload
                            width={192}
                            height={192}
                        />
                    </span>
                ) : (
                    <span
                        className="public-content-card-view-transition inline-flex size-48 items-center justify-center overflow-hidden"
                        style={{
                            viewTransitionName: getPlantImageViewTransitionName(
                                plant.id,
                            ),
                        }}
                    >
                        <PlantOrSortImage
                            plant={plant}
                            preload
                            width={192}
                            height={192}
                        />
                    </span>
                )
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
                <Stack spacing={8} alignItems="start">
                    {(origin || alternativeNames) && (
                        <Stack spacing={2}>
                            <Typography level="body2">Porijeklo</Typography>
                            {origin && (
                                <Row spacing={2}>
                                    <MapPinHouse className="size-5 shrink-0" />
                                    <Typography>{origin}</Typography>
                                </Row>
                            )}
                            {alternativeNames && (
                                <Typography level="body2" secondary>
                                    Alternativni nazivi: {alternativeNames}
                                </Typography>
                            )}
                        </Stack>
                    )}
                    <Row spacing={2}>
                        {plant.information.verified && (
                            <VerifiedInformationBadge />
                        )}
                        {plant.isRecommended && <SeedTimeInformationBadge />}
                    </Row>
                    {sort?.store?.availableInStore === false && (
                        <Typography
                            level="body2"
                            className="text-amber-800 dark:text-amber-300 font-semibold"
                        >
                            Trenutno nije dostupna za sjetvu
                        </Typography>
                    )}
                    {contentLinks.length > 0 && (
                        <Stack spacing={2}>
                            <Typography level="body2">Sadržaj</Typography>
                            <Row spacing={2} className="flex-wrap">
                                {contentLinks.map((link) => (
                                    <Chip
                                        key={link.href}
                                        color="neutral"
                                        href={link.href}
                                    >
                                        {link.label}
                                    </Chip>
                                ))}
                            </Row>
                        </Stack>
                    )}
                    <NavigatingButton
                        href={KnownPages.GardenApp}
                        className="bg-green-800 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
                    >
                        Moj vrt
                    </NavigatingButton>
                </Stack>
            }
        >
            <Stack>
                <PlantCalendarPicker plant={plant} sort={sort} />
                <Stack spacing={2} className="group">
                    <Typography level="h5" component="h2">
                        Informacije
                    </Typography>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {price && (
                            <PriceAttributeCard
                                icon={<Sprout />}
                                header="Cijena sijanja"
                                entityId={price.entityId}
                                entityTypeName={price.entityTypeName}
                                currentPrice={price.currentPrice}
                                description="Cijena jedne biljke uključuje troškove sjemena, pripreme tla, sjetve i sezonske pogodnosti. Više o samoj sjetvi u gredicama možeš pročitati u nastavku."
                                navigateHref={KnownPages.Sowing}
                                navigateLabel="Više o sjetvi"
                            />
                        )}
                        <AttributeCard
                            icon={<PlantGridIcon totalPlants={totalPlants} />}
                            header={`Broj biljaka na ${FIELD_SIZE_LABEL}`}
                            value={totalPlants.toString()}
                            description={`Podignuta gredica podjeljena je na polja veličine ${FIELD_SIZE_LABEL}. Gredica dimenzija 2x1 metar ima 18 polja za sijanje tvojih biljaka. U svako polje može stati određeni broj biljaka, ovisno o vrsti odnosno o razmaku sijanja/sadnje biljke.`}
                            navigateHref={KnownPages.RaisedBeds}
                            navigateLabel="Više o gredicama"
                        />
                    </div>
                    <Row
                        spacing={1}
                        className="self-end md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                    >
                        {overviewEditTarget ? (
                            <CommunityEditButton
                                entityTypeName={
                                    overviewEditTarget.entityTypeName
                                }
                                entityId={overviewEditTarget.entityId}
                                publicPath={overviewEditTarget.publicPath}
                                sectionKey="overview"
                            />
                        ) : null}
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
                        />
                    </Row>
                    <Typography level="body2" secondary>
                        Nisi zadovoljan uslugom ili proizvodom? Pogledaj{' '}
                        <Link className="underline" href={KnownPages.Refunds}>
                            30-dnevnu politiku povrata novca
                        </Link>
                        .
                    </Typography>
                </Stack>
            </Stack>
        </PageHeader>
    );
}
