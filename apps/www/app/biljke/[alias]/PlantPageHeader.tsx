import type { OperationData, PlantData } from '@gredice/client';
import { calculatePlantsPerField, FIELD_SIZE_LABEL } from '@gredice/js/plants';
import { slug } from '@gredice/js/slug';
import { Chip } from '@gredice/ui/Chip';
import { GameLocationIcon } from '@gredice/ui/GameIcons';
import { PlantGridIcon } from '@gredice/ui/GridIcons';
import { PageHeader } from '@gredice/ui/PageHeader';
import { PlantOrSortImage, SeedTimeInformationBadge } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { AttributeCard } from '../../../components/attributes/DetailCard';
import type { CommunityContributorView } from '../../../components/community-edits/communityContributors';
import { SectionContributionBar } from '../../../components/community-edits/SectionContributionBar';
import type { PlantSortDataWithRelationships } from '../../../lib/plants/getPlantSortsData';
import { KnownPages } from '../../../src/KnownPages';
import { getPlantImageViewTransitionName } from '../plantViewTransition';
import { getPlantInforationSections } from './getPlantInforationSections';
import { PlantCalendarPicker } from './PlantCalendarPicker';
import { PlantSowingOffer } from './PlantSowingOffer';
import { plantHealthSectionId } from './plantPageSections';
import { getPlantSowingOffer } from './plantSowingOfferData';
import { VerifiedInformationBadge } from './VerifiedInformationBadge';

type InformationWithAlternativeName = {
    name?: unknown;
    alternativeName?: unknown;
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
    operations,
    overviewContributors,
    overviewEditTarget,
    plant,
    sort,
}: {
    operations?: readonly OperationData[];
    /** Gardeners whose accepted suggestions shaped the overview. */
    overviewContributors?: readonly CommunityContributorView[];
    overviewEditTarget?: OverviewEditTarget;
    plant: PlantData & { isRecommended: boolean | null | undefined };
    sort?: PlantSortDataWithRelationships;
}) {
    const informationSections = getPlantInforationSections(
        plant,
        sort,
        operations,
    );
    const { totalPlants } = calculatePlantsPerField(
        plant.attributes?.seedingDistance,
        sort?.information.name ?? plant.information.name,
    );
    const contentLinks = informationSections
        .filter((section) => section.avaialble)
        .map((section) => ({
            href: `#${slug(section.header)}`,
            label: section.header,
        }));
    if (!sort) {
        contentLinks.unshift({
            href: `#${slug('Sorte')}`,
            label: 'Sorte',
        });
    }
    if ((plant.information.tip?.length ?? 0) > 0) {
        contentLinks.push({
            href: `#${slug('Savjeti')}`,
            label: 'Savjeti',
        });
    }
    contentLinks.push({
        href: `#${plantHealthSectionId}`,
        label: 'Bolesti i štetnici',
    });
    contentLinks.push({
        href: `#${slug('Biljni susjedi')}`,
        label: 'Biljni susjedi',
    });

    const baseLatinName = plant.information.latinName
        ? `lat. ${plant.information.latinName}`
        : null;
    const sortLatinName = `lat. ${sort?.information.latinName ?? '-'}`;
    const origin = sort?.information.origin ?? plant.information.origin;
    const alternativeNames =
        formatAlternativeNames(sort?.information) ||
        formatAlternativeNames(plant.information);
    const sowingOffer = getPlantSowingOffer(plant, sort);
    const displayName = sort?.information?.name ?? plant.information.name;

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
            header={displayName}
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
                    <PlantSowingOffer {...sowingOffer} />
                    {(origin || alternativeNames) && (
                        <Stack spacing={2}>
                            <Typography level="body2">Porijeklo</Typography>
                            {origin && (
                                <Row spacing={2}>
                                    <GameLocationIcon
                                        aria-hidden
                                        className="size-5 shrink-0"
                                    />
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
                        <AttributeCard
                            icon={<PlantGridIcon totalPlants={totalPlants} />}
                            header={`Broj biljaka na ${FIELD_SIZE_LABEL}`}
                            value={totalPlants.toString()}
                            description={`Podignuta gredica podjeljena je na polja veličine ${FIELD_SIZE_LABEL}. Gredica dimenzija 2x1 metar ima 18 polja za sijanje tvojih biljaka. U svako polje može stati određeni broj biljaka, ovisno o vrsti odnosno o razmaku sijanja/sadnje biljke.`}
                            navigateHref={KnownPages.RaisedBeds}
                            navigateLabel="Više o gredicama"
                        />
                    </div>
                    <SectionContributionBar
                        feedback={{
                            topic: sort
                                ? 'www/plants/sorts/information'
                                : 'www/plants/information',
                            data: {
                                plantId: plant.id,
                                plantAlias: plant.information.name,
                                sortId: sort?.id,
                                sortAlias: sort?.information.name,
                            },
                        }}
                        edit={
                            overviewEditTarget
                                ? {
                                      entityTypeName:
                                          overviewEditTarget.entityTypeName,
                                      entityId: overviewEditTarget.entityId,
                                      publicPath: overviewEditTarget.publicPath,
                                      sectionKey: 'overview',
                                      entityName: displayName,
                                      sectionLabel: 'Pregled',
                                  }
                                : null
                        }
                        contributors={overviewContributors}
                    />
                </Stack>
            </Stack>
        </PageHeader>
    );
}
