import { Card, CardContent, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { ReactNode } from "react";
import { EntitiesTable } from "./EntitiesTable";
import { Row } from "@signalco/ui-primitives/Row";
import { Add } from "@signalco/ui-icons";
import { revalidatePath } from "next/cache";
import { ServerActionIconButton } from "./ServerActionIconButton";
import { redirect } from "next/navigation";
import { BookA } from "lucide-react";
import Link from "next/link";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { createEntity } from "@gredice/storage";

export const dynamic = 'force-dynamic';

async function createPlant(entityType: string) {
    'use server';

    const plantId = await createEntity(entityType);
    revalidatePath('/admin/plants');
    redirect(`/admin/plants/${plantId}`);
}

export default function PlantsLayout({ children, params }: { children: ReactNode, params: { entityType: string } }) {
    return (
        <div className='grid grid-cols-3 gap-4 p-4'>
            <Card className="h-fit max-h-screen sticky top-20">
                <CardHeader>
                    <Row spacing={1} justifyContent="space-between">
                        <CardTitle>Biljke</CardTitle>
                        <Row>
                            <Link href={`/admin/directories/${params.entityType}/attribute-definitions`}>
                                <IconButton variant="plain" title="Definicija atributa">
                                    <BookA />
                                </IconButton>
                            </Link>
                            <ServerActionIconButton
                                variant="plain"
                                title="Dodaj zapis"
                                actionProps={[params.entityType]}
                                onClick={createPlant}>
                                <Add />
                            </ServerActionIconButton>
                        </Row>
                    </Row>
                </CardHeader>
                <CardOverflow>
                    <EntitiesTable entityType={params.entityType} />
                </CardOverflow>
            </Card>
            <Card className='col-span-2'>
                <CardContent className="pt-6">
                    {children}
                </CardContent>
            </Card>
        </div>
    );

}
