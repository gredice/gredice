import { isOperationApplicableToPlant } from '@gredice/js/operations';
import { getHarvestBehaviorOverviewDisclaimer } from '@gredice/js/plants';
import { BlockImage } from '@gredice/ui/BlockImage';
import { Card, CardContent } from '@gredice/ui/Card';
import { Leaf } from '@gredice/ui/icons';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Typography } from '@gredice/ui/Typography';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { getOperationsData } from '../../../lib/plants/getOperationsData';
import { getPlantsData } from '../../../lib/plants/getPlantsData';
import { KnownPages } from '../../../src/KnownPages';

const noLinkedPlantOperations = new Set<string>();

export async function OperationApplicationsList({
    operationId,
}: {
    operationId: number;
}) {
    const operationsData = await getOperationsData();
    const operation = operationsData?.find((op) => op.id === operationId);
    if (!operation) {
        return (
            <NoDataPlaceholder className="text-left py-4">
                Nije dostupno
            </NoDataPlaceholder>
        );
    }

    if (operation.attributes.internal === true) {
        return (
            <div className="py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-tertiary border-b-4">
                    <CardContent noHeader>
                        <Typography>Za OPG partnere</Typography>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (operation.attributes.application === 'garden') {
        return (
            <div className="py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-tertiary border-b-4">
                    <CardContent noHeader>
                        <Row justifyContent="space-between">
                            <Typography>Dostupno u tvom vrtu</Typography>
                            <NavigatingButton
                                href={KnownPages.GardenApp}
                                className="bg-green-800 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
                            >
                                Moj vrt
                            </NavigatingButton>
                        </Row>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (
        operation.attributes.application === 'raisedBedFull' ||
        operation.attributes.application === 'raisedBed1m'
    ) {
        return (
            <div className="py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-tertiary border-b-4">
                    <CardContent noHeader>
                        <Row spacing={4}>
                            <BlockImage
                                blockName="Raised_Bed"
                                width={42}
                                height={42}
                            />
                            <Typography>
                                Ova radnja je dostupna u svim gredicama
                            </Typography>
                        </Row>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (operation.attributes.application === 'plant') {
        if (isOperationApplicableToPlant(operation, noLinkedPlantOperations)) {
            return (
                <div className="py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    <Card className="border-tertiary border-b-4">
                        <CardContent noHeader>
                            <Row spacing={4}>
                                <Leaf aria-hidden className="size-6 shrink-0" />
                                <Typography>
                                    Ova radnja je dostupna za sve biljke
                                </Typography>
                            </Row>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        const plants = await getPlantsData();
        const plantsWithOperation = plants?.filter((plant) =>
            plant.information.operations
                ?.map((op) => op.information?.name)
                .includes(operation.information.name),
        );
        const isHarvestOperation =
            operation.attributes.stage.information?.name === 'harvest';
        const plantsRemovedAfterHarvest = isHarvestOperation
            ? (plantsWithOperation?.filter(
                  (plant) => plant.attributes?.cleanHarvest === true,
              ) ?? [])
            : [];
        if (plantsWithOperation && (plantsWithOperation?.length ?? 0) > 0) {
            return (
                <div className="py-4 space-y-3">
                    {isHarvestOperation && (
                        <Typography level="body2">
                            {getHarvestBehaviorOverviewDisclaimer()}
                        </Typography>
                    )}
                    {plantsRemovedAfterHarvest.length > 0 && (
                        <Typography level="body2" semiBold>
                            Automatsko uklanjanje nakon berbe:{' '}
                            {plantsRemovedAfterHarvest
                                .map(
                                    (plant) =>
                                        plant.information.name ?? 'Nepoznato',
                                )
                                .join(', ')}
                            .
                        </Typography>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                        {plantsWithOperation.map((plant) => (
                            <Card
                                key={plant.id}
                                href={KnownPages.Plant(plant.information.name)}
                                className="border-tertiary border-b-4"
                            >
                                <CardContent noHeader>
                                    <Row spacing={4}>
                                        <PlantOrSortImage
                                            plant={plant}
                                            width={42}
                                            height={42}
                                        />
                                        <Typography>
                                            {plant.information.name ??
                                                'Nepoznato'}
                                        </Typography>
                                    </Row>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            );
        }
    }

    return (
        <NoDataPlaceholder className="text-left py-4">
            Nije dostupno
        </NoDataPlaceholder>
    );
}
