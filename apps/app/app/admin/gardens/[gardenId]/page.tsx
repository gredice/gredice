import { getGarden, getRaisedBeds } from "@gredice/storage";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Table } from "@signalco/ui-primitives/Table";
import { auth } from "../../../../lib/auth/auth";
import { NoDataPlaceholder } from "../../../../components/shared/placeholders/NoDataPlaceholder";
import { LocaleDateTime } from "../../../../components/shared/LocaleDateTime";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { KnownPages } from "../../../../src/KnownPages";
import { Field } from "../../../../components/shared/fields/Field";
import { FieldSet } from "../../../../components/shared/fields/FieldSet";
import Link from "next/link";

export const dynamic = 'force-dynamic';

function GardenPreviewCard({ gardenId }: { gardenId: number }) {
    return (
        <Card className="overflow-hidden">
            <CardOverflow>
                <img
                    src={`https://vrt.gredice.com/vrtovi/${gardenId}/opengraph-image?fullscreen=true`}
                    alt="Vrt"
                    className="w-full h-auto" />
            </CardOverflow>
        </Card>
    );
}

export default async function GardenPage({ params }: { params: Promise<{ gardenId: number; }> }) {
    const { gardenId } = await params;
    await auth(['admin']);
    const garden = await getGarden(gardenId);
    const raisedBeds = await getRaisedBeds(gardenId);

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
                <GardenPreviewCard gardenId={gardenId} />
            </div>
            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>ID</Table.Head>
                                <Table.Head>Datum Kreiranja</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {raisedBeds.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={2}>
                                        <NoDataPlaceholder>
                                            Nema gredica
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {raisedBeds.map(bed => (
                                <Table.Row key={bed.id}>
                                    <Table.Cell>{bed.id}</Table.Cell>
                                    <Table.Cell><LocaleDateTime>{bed.createdAt}</LocaleDateTime></Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </CardOverflow>
            </Card>
        </Stack>
    );
}