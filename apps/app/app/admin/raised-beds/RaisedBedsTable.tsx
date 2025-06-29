"use client";

import { useState, useMemo } from "react";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Table } from "@signalco/ui-primitives/Table";
import { KnownPages } from "../../../src/KnownPages";
import Link from "next/link";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";
import { LocaleDateTime } from "../../../components/shared/LocaleDateTime";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Stack } from "@signalco/ui-primitives/Stack";
import { getAllRaisedBeds } from "@gredice/storage";

export function RaisedBedsTable({ raisedBeds }: { raisedBeds: Array<{ id: number; name: string; createdAt: Date; updatedAt: Date; accountId: string; isDeleted: boolean; gardenId: number; blockId: string; status: string; fields: any[] }> }) {
    const [filter, setFilter] = useState<'all' | 'active' | 'new'>('all');

    const filteredBeds = useMemo(() => {
        if (filter === 'all') return raisedBeds;
        return raisedBeds.filter(bed => bed.status === filter);
    }, [filter, raisedBeds]);

    return (
        <Stack spacing={2}>
            <Typography level="h1" className="text-2xl" semiBold>Gredice</Typography>
            <div className="mb-4">
                <label htmlFor="filter" className="mr-2 font-medium">Prikaži:</label>
                <select
                    id="filter"
                    value={filter}
                    onChange={e => setFilter(e.target.value as 'all' | 'active' | 'new')}
                    className="border rounded px-2 py-1"
                >
                    <option value="all">Sve</option>
                    <option value="active">Aktivne</option>
                    <option value="new">Nove</option>
                </select>
            </div>
            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>ID</Table.Head>
                                <Table.Head>Naziv</Table.Head>
                                <Table.Head>Status</Table.Head>
                                <Table.Head>Broj Polja</Table.Head>
                                <Table.Head>Datum Kreiranja</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {filteredBeds.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={5}>
                                        <NoDataPlaceholder>
                                            Nema gredica
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {filteredBeds.map(bed => (
                                <Table.Row key={bed.id}>
                                    <Table.Cell>
                                        <Link href={KnownPages.RaisedBed(Number(bed.id))}>
                                            {bed.id}
                                        </Link>
                                    </Table.Cell>
                                    <Table.Cell>{bed.name}</Table.Cell>
                                    <Table.Cell>{bed.status}</Table.Cell>
                                    <Table.Cell>{Array.isArray(bed.fields) ? bed.fields.length : 0}</Table.Cell>
                                    <Table.Cell><LocaleDateTime>{new Date(bed.createdAt)}</LocaleDateTime></Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </CardOverflow>
            </Card>
        </Stack>
    );
}
