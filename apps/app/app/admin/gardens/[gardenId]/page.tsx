import { getGarden } from "@gredice/storage";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { auth } from "../../../../lib/auth/auth";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { KnownPages } from "../../../../src/KnownPages";
import { Field } from "../../../../components/shared/fields/Field";
import { FieldSet } from "../../../../components/shared/fields/FieldSet";
import Link from "next/link";
import { RaisedBedsTableCard } from "../../accounts/[accountId]/RaisedBedsTableCard";
import { notFound } from "next/navigation";

export const dynamic = 'force-dynamic';

function GardenPreviewCard({ gardenId, gardenName }: { gardenId: number, gardenName: string }) {
    return (
        <Card className="overflow-hidden">
            <CardOverflow>
                <img
                    src={`https://vrt.gredice.com/vrtovi/${gardenId}/opengraph-image?fullscreen=true`}
                    alt={gardenName}
                />
            </CardOverflow>
        </Card>
    );
}

export default async function GardenPage({ params }: { params: Promise<{ gardenId: number; }> }) {
    const { gardenId } = await params;
    await auth(['admin']);
    const garden = await getGarden(gardenId);

    if (!garden) {
        notFound();
    }

    return (
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Breadcrumbs items={[
                    { label: 'Vrtovi', href: KnownPages.Gardens },
                    { label: garden?.name }
                ]} />
                <Stack spacing={2}>
                    <FieldSet>
                        <Field name="ID vrta" value={garden?.id} mono />
                        <Field name="Naziv" value={garden?.name} />
                        <Field name="Račun" value={(<Link href={garden?.accountId ? KnownPages.Account(garden.accountId) : '#'}>{garden?.accountId}</Link>)} mono />
                        <Field name="Obrisan" value={garden?.isDeleted} />
                    </FieldSet>
                    <FieldSet>
                        <Field name="Datum kreiranja" value={garden?.createdAt} />
                        <Field name="Datum ažuriranja" value={garden?.updatedAt} />
                    </FieldSet>
                </Stack>
            </Stack>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <GardenPreviewCard gardenId={gardenId} gardenName={garden.name} />
            </div>
            <RaisedBedsTableCard gardenId={gardenId} />
        </Stack>
    );
}