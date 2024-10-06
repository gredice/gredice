import { Card, CardContent, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { ReactNode } from "react";
import { PlantsTable } from "./PlantsTable";
import { Row } from "@signalco/ui-primitives/Row";
import { Add } from "@signalco/ui-icons";
import { createPlant as storageCreatePlant } from "@gredice/storage";
import { revalidatePath } from "next/cache";
import { ServerActionIconButton } from "./ServerActionIconButton";
import { redirect } from "next/navigation";
import { BookA } from "lucide-react";
import Link from "next/link";
import { IconButton } from "@signalco/ui-primitives/IconButton";

async function createPlant() {
    'use server';

    const plantId = await storageCreatePlant();
    revalidatePath('/admin/plants');
    redirect(`/admin/plants/${plantId}`);
}

export default function PlantsLayout({ children }: { children: ReactNode }) {
    return (
        <div className='grid grid-cols-3 gap-4 p-4'>
            <Card className="h-fit max-h-screen sticky top-20">
                <CardHeader>
                    <Row spacing={1} justifyContent="space-between">
                        <CardTitle>Biljke</CardTitle>
                        <Row>
                            <Link href={`/admin/plants/attribute-definitions`}>
                                <IconButton variant="plain" title="Definicija atributa">
                                    <BookA />
                                </IconButton>
                            </Link>
                            <ServerActionIconButton
                            variant="plain"
                            title="Dodaj biljku"
                            onClick={createPlant}>
                            <Add />
                            </ServerActionIconButton>
                        </Row>
                    </Row>
                </CardHeader>
                <CardOverflow>
                    <PlantsTable />
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