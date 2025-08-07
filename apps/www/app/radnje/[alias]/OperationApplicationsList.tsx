import { Card, CardContent } from "@signalco/ui-primitives/Card";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";
import { getOperationsData } from "../../../lib/plants/getOperationsData";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { NavigatingButton } from "@signalco/ui/NavigatingButton";
import { KnownPages } from "../../../src/KnownPages";
import { BlockImage } from "@gredice/ui/BlockImage";
import { getPlantsData } from "../../../lib/plants/getPlantsData";
import { PlantImage } from "../../../components/plants/PlantImage";

export async function OperationApplicationsList({ operationId }: { operationId: number }) {
    const operationsData = await getOperationsData();
    const operation = operationsData?.find(op => op.id === operationId);
    if (!operation) {
        return <NoDataPlaceholder className="text-left py-4">Nije dostupno</NoDataPlaceholder>
    }

    if (operation.attributes.application === 'garden') {
        return (
            <div className="py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardContent noHeader>
                        <Row justifyContent="space-between">
                            <Typography>Dostupno u tvom vrtu</Typography>
                            <NavigatingButton href={KnownPages.GardenApp} className="bg-green-800 hover:bg-green-700">
                                Moj vrt
                            </NavigatingButton>
                        </Row>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (operation.attributes.application === 'raisedBedFull' ||
        operation.attributes.application === 'raisedBed1m') {
        return (
            <div className="py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardContent noHeader>
                        <Row spacing={2}>
                            <BlockImage blockName="Raised_Bed" width={42} height={42} />
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
        const plants = await getPlantsData();
        const plantsWithOperation = plants?.filter(plant => plant.information.operations?.map(op => op.information?.name).includes(operation.information.name));
        if (plantsWithOperation && (plantsWithOperation?.length ?? 0) > 0) {
            return (
                <div className="py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                    {plantsWithOperation.map(plant => (
                        <Card key={plant.id} href={KnownPages.Plant(plant.information.name)}>
                            <CardContent noHeader>
                                <Row spacing={2}>
                                    <PlantImage plant={plant} width={42} height={42} />
                                    <Typography>
                                        {plant.information.name ?? 'Nepoznato'}
                                    </Typography>
                                </Row>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )
        }
    }

    return <NoDataPlaceholder className="text-left py-4">Nije dostupno</NoDataPlaceholder>
}