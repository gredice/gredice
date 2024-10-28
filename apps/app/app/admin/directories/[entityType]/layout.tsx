import { Card, CardContent, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { ReactNode, Suspense } from "react";
import { Row } from "@signalco/ui-primitives/Row";
import { Add } from "@signalco/ui-icons";
import { ServerActionIconButton } from "../../../../components/shared/ServerActionIconButton";
import { getEntityTypeByName } from "@gredice/storage";
import { createEntity } from "../../../(actions)/entityActions";
import { CardHeaderSkeleton } from "../../../../components/shared/skeletons/CardHeaderSkeleton";
import { CardContentListSkeleton } from "../../../../components/shared/skeletons/CardContentListSkeleton";

export const dynamic = 'force-dynamic';

async function EntityTypeListCardHeader({ entityTypeName }: { entityTypeName: string }) {
    const entityType = await getEntityTypeByName(entityTypeName);

    return (
        <CardHeader>
            <Row spacing={1} justifyContent="space-between">
                <CardTitle>{entityType?.label}</CardTitle>
            </Row>
        </CardHeader>
    );
}

export default async function PlantsLayout(
    props: { children: ReactNode, list: ReactNode, params: Promise<{ entityType: string }> }
) {
    const params = await props.params;

    const {
        children,
        list
    } = props;

    return (
        <div className='grid grid-cols-3 gap-4'>
            <Card className="h-fit">
                <Suspense fallback={<CardHeaderSkeleton />}>
                    <EntityTypeListCardHeader entityTypeName={params.entityType} />
                </Suspense>
                <CardOverflow>
                    <Suspense fallback={<CardContentListSkeleton />}>
                        {list}
                    </Suspense>
                </CardOverflow>
            </Card>
            <Suspense>
                <Card className='col-span-2 h-fit'>
                    <CardContent className="pt-6">
                        {children}
                    </CardContent>
                </Card>
            </Suspense>
        </div>
    );
}
