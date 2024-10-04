import { Card, CardContent, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { ReactNode } from "react";
import { PlantsTable } from "./PlantsTable";

export default function PlantsLayout({ children }: { children: ReactNode }) {
    return (
        <div className='grid grid-cols-3 gap-4 p-4'>
            <Card className="h-fit max-h-screen sticky top-4">
                <CardHeader>
                    <CardTitle>Biljke</CardTitle>
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