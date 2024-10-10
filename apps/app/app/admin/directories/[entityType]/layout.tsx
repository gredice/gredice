import { Card, CardContent, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { ReactNode } from "react";
import { Row } from "@signalco/ui-primitives/Row";
import { Add } from "@signalco/ui-icons";
import { ServerActionIconButton } from "../../../../components/shared/ServerActionIconButton";
import { BookA, LayoutList } from "lucide-react";
import Link from "next/link";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { getEntityTypeByName } from "@gredice/storage";
import { createEntity } from "../../../(actions)/entityActions";

export const dynamic = 'force-dynamic';

export default async function PlantsLayout({ children, list, params }: { children: ReactNode, list: ReactNode, params: { entityType: string } }) {
    const entityType = await getEntityTypeByName(params.entityType);

    return (
        <div className='grid grid-cols-3 gap-4'>
            <Card className="h-fit">
                <CardHeader>
                    <Row spacing={1} justifyContent="space-between">
                        <CardTitle>{entityType?.label}</CardTitle>
                        <Row spacing={1}>
                            <Row>
                                <Link href={`/admin/directories/${params.entityType}`}>
                                    <IconButton variant="outlined" title="Lista entiteta" className="rounded-r-none border-r-[0.5px]">
                                        <LayoutList />
                                    </IconButton>
                                </Link>
                            <Link href={`/admin/directories/${params.entityType}/attribute-definitions`}>
                                    <IconButton variant="outlined" title="Definicija atributa" className="rounded-l-none border-l-[0.5px]">
                                    <BookA />
                                </IconButton>
                            </Link>
                            </Row>
                            <ServerActionIconButton
                                variant="plain"
                                title="Dodaj zapis"
                                actionProps={[params.entityType]}
                                onClick={createEntity}>
                                <Add />
                            </ServerActionIconButton>
                        </Row>
                    </Row>
                </CardHeader>
                <CardOverflow>
                    {list}
                </CardOverflow>
            </Card>
            <Card className='col-span-2 h-fit'>
                <CardContent className="pt-6">
                    {children}
                </CardContent>
            </Card>
        </div>
    );

}
