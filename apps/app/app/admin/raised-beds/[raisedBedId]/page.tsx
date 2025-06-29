import { getRaisedBed } from "@gredice/storage";
import { Card, CardHeader, CardTitle, CardContent, CardOverflow } from "@signalco/ui-primitives/Card";
import { auth } from "../../../../lib/auth/auth";
import { KnownPages } from "../../../../src/KnownPages";
import { Field } from "../../../../components/shared/fields/Field";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { Table } from "@signalco/ui-primitives/Table";
import { NoDataPlaceholder } from "../../../../components/shared/placeholders/NoDataPlaceholder";
import { notFound } from "next/navigation";
import { LocaleDateTime } from "../../../../components/shared/LocaleDateTime";
import { RaisedBedFieldPlantStatusSelector } from "./RaisedBedFieldPlantStatusSelector";
import { NotificationsTableCard } from "../../../../components/notifications/NotificationsTableCard";

export const dynamic = 'force-dynamic';

export default async function RaisedBedPage({ params }: { params: Promise<{ raisedBedId: number; }> }) {
    const { raisedBedId } = await params;
    await auth(['admin']);
    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        notFound();
    }

    return (
        <Stack spacing={4}>
            <Breadcrumbs items={[
                { label: 'Računi', href: KnownPages.Accounts },
                { label: raisedBed.accountId, href: KnownPages.Account(raisedBed.accountId) },
                { label: 'Vrtovi', href: KnownPages.Gardens },
                { label: raisedBed.gardenId, href: KnownPages.Garden(raisedBed.gardenId) },
                { label: 'Gredice', href: KnownPages.RaisedBeds },
                { label: raisedBed?.id }
            ]} />
            <Card>
                <CardHeader>
                    <CardTitle>{raisedBed?.id}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Field name="ID" value={raisedBed?.id} mono />
                    <Field name="Naziv" value={raisedBed?.name} />
                    <Field name="Datum kreiranja" value={raisedBed?.createdAt} />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Polja</CardTitle>
                </CardHeader>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Lokacija</Table.Head>
                                <Table.Head>Status</Table.Head>
                                <Table.Head>Planirani datum sadnje</Table.Head>
                                <Table.Head>Datum kreiranja</Table.Head>
                                <Table.Head>Datum zadnje promjene</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {raisedBed?.fields?.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={2}>
                                        <NoDataPlaceholder />
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {raisedBed?.fields?.sort((fa, fb) => fa.positionIndex - fb.positionIndex).map((field) => (
                                <Table.Row key={field.id}>
                                    <Table.Cell>{field.positionIndex + 1}</Table.Cell>
                                    <Table.Cell>
                                        <RaisedBedFieldPlantStatusSelector
                                            raisedBedId={raisedBed.id}
                                            positionIndex={field.positionIndex}
                                            status={field.plantStatus}
                                        />
                                    </Table.Cell>
                                    <Table.Cell><LocaleDateTime time={false}>{new Date(field.plantScheduledDate)}</LocaleDateTime></Table.Cell>
                                    <Table.Cell><LocaleDateTime time={false}>{field.createdAt}</LocaleDateTime></Table.Cell>
                                    <Table.Cell><LocaleDateTime time={false}>{field.updatedAt}</LocaleDateTime></Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </CardOverflow>
            </Card>
            <NotificationsTableCard
                accountId={raisedBed.accountId}
                gardenId={raisedBed.gardenId}
                raisedBedId={raisedBed.id}
            />
        </Stack>
    );
}