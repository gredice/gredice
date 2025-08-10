import { getEntitiesFormatted, getRaisedBed } from "@gredice/storage";
import { Card, CardHeader, CardTitle, CardOverflow } from "@signalco/ui-primitives/Card";
import { auth } from "../../../../lib/auth/auth";
import { KnownPages } from "../../../../src/KnownPages";
import { Field } from "../../../../components/shared/fields/Field";
import { FieldSet } from "../../../../components/shared/fields/FieldSet";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Table } from "@signalco/ui-primitives/Table";
import { NoDataPlaceholder } from "../../../../components/shared/placeholders/NoDataPlaceholder";
import { notFound } from "next/navigation";
import { LocaleDateTime } from "../../../../components/shared/LocaleDateTime";
import { RaisedBedFieldPlantStatusSelector } from "./RaisedBedFieldPlantStatusSelector";
import { NotificationsTableCard } from "../../../../components/notifications/NotificationsTableCard";
import { OperationsTableCard } from "./OperationsTableCard";
import { EntityStandardized } from "../../../../lib/@types/EntityStandardized";

export const dynamic = 'force-dynamic';

export default async function RaisedBedPage({ params }: { params: Promise<{ raisedBedId: number; }> }) {
    const { raisedBedId } = await params;
    await auth(['admin']);
    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        notFound();
    }

    const sortsData = await getEntitiesFormatted<EntityStandardized>('plantSort');

    return (
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Stack spacing={2}>
                    <Breadcrumbs items={[
                        { label: 'Računi', href: KnownPages.Accounts },
                        { label: raisedBed.accountId ?? 'Nepoznato', href: raisedBed.accountId ? KnownPages.Account(raisedBed.accountId) : undefined },
                        { label: 'Vrtovi', href: KnownPages.Gardens },
                        { label: raisedBed.gardenId ?? 'Nepoznato', href: raisedBed.gardenId ? KnownPages.Garden(raisedBed.gardenId) : undefined },
                        { label: 'Gredice', href: KnownPages.RaisedBeds },
                        { label: raisedBed?.id }
                    ]} />
                    <Typography level="h1" semiBold>Gredica</Typography>
                </Stack>
                <Stack spacing={2}>
                    <FieldSet>
                        <Field name="ID" value={raisedBed?.id} mono />
                        <Field name="Naziv" value={raisedBed?.name} />
                        <Field name="Fizička oznaka" value={raisedBed?.physicalId} />
                        <Field name="Datum kreiranja" value={raisedBed?.createdAt} />
                    </FieldSet>
                </Stack>
            </Stack>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Polja</CardTitle>
                    </CardHeader>
                    <CardOverflow>
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head>Lokacija</Table.Head>
                                    <Table.Head>Biljka</Table.Head>
                                    <Table.Head>Status</Table.Head>
                                    <Table.Head>Planirani datum sadnje</Table.Head>
                                    <Table.Head>Datum kreiranja</Table.Head>
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
                                {raisedBed?.fields?.sort((fa, fb) => fa.positionIndex - fb.positionIndex).map((field) => {
                                    const sortData = sortsData?.find(sort => sort.id === field.plantSortId);
                                    return (
                                        <Table.Row key={field.id}>
                                            <Table.Cell>{field.positionIndex + 1}</Table.Cell>
                                            <Table.Cell>{sortData?.information?.name}</Table.Cell>
                                            <Table.Cell>
                                                {field.plantStatus ? (
                                                    <RaisedBedFieldPlantStatusSelector
                                                        raisedBedId={raisedBed.id}
                                                        positionIndex={field.positionIndex}
                                                        status={field.plantStatus} />
                                                ) : '-'}
                                            </Table.Cell>
                                            <Table.Cell>{field.plantScheduledDate ? <LocaleDateTime time={false}>{new Date(field.plantScheduledDate)}</LocaleDateTime> : '-'}</Table.Cell>
                                            <Table.Cell><LocaleDateTime time={false}>{field.createdAt}</LocaleDateTime></Table.Cell>
                                        </Table.Row>
                                    );
                                })}
                            </Table.Body>
                        </Table>
                    </CardOverflow>
                </Card>
                {raisedBed.accountId && raisedBed.gardenId && (
                    <>
                        <OperationsTableCard
                            accountId={raisedBed.accountId}
                            gardenId={raisedBed.gardenId}
                            raisedBedId={raisedBed.id} />
                        <NotificationsTableCard
                            accountId={raisedBed.accountId}
                            gardenId={raisedBed.gardenId}
                            raisedBedId={raisedBed.id}
                        />
                    </>
                )}
            </div>
        </Stack>
    );
}