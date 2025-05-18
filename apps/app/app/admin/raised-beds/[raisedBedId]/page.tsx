import { getRaisedBed } from "@gredice/storage";
import { Card, CardHeader, CardTitle, CardContent } from "@signalco/ui-primitives/Card";
import { auth } from "../../../../lib/auth/auth";
import { KnownPages } from "../../../../src/KnownPages";
import { Field } from "../../../../components/shared/fields/Field";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";

export const dynamic = 'force-dynamic';

export default async function RaisedBedPage({ params }: { params: { raisedBedId: number; } }) {
    const { raisedBedId } = params;
    await auth(['admin']);
    const raisedBed = await getRaisedBed(raisedBedId);

    return (
        <Stack spacing={4}>
            <Breadcrumbs items={[
                { label: 'Gredice', href: KnownPages.RaisedBeds },
                { label: raisedBed?.id }
            ]} />
            <Card>
                <CardHeader>
                    <CardTitle>{raisedBed?.id}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Field name="ID" value={raisedBed?.id} mono />
                    <Field name="Datum kreiranja" value={raisedBed?.createdAt} />
                </CardContent>
            </Card>
        </Stack>
    );
}