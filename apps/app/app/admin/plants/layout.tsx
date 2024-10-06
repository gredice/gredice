import { Card, CardContent, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { ReactNode } from "react";
import { PlantsTable } from "./PlantsTable";
import { Row } from "@signalco/ui-primitives/Row";
import { Add } from "@signalco/ui-icons";
import { createPlant as storageCreatePlant } from "@gredice/storage";
import { revalidatePath } from "next/cache";
import { CreateEntityButton } from "./CreateEntityButton";
import { redirect } from "next/navigation";

async function createPlant() {
    'use server';

    const plantId = await storageCreatePlant();
    revalidatePath('/admin/plants');
    redirect(`/admin/plants/${plantId}`);
}

export default function PlantsLayout({ children }: { children: ReactNode }) {
    return (
        <div className='grid grid-cols-3 gap-4 p-4'>
            <Card className="h-fit max-h-screen sticky top-4">
                <CardHeader>
                    <Row spacing={1} justifyContent="space-between">
                    <CardTitle>Biljke</CardTitle>
                        <CreateEntityButton
                            variant="plain"
                            title="Dodaj biljku"
                            onClick={createPlant}>
                            <Add />
                        </CreateEntityButton>
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