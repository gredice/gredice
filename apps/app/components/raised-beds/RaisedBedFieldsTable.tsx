import { getEntitiesFormatted, getRaisedBed } from "@gredice/storage";
import { Table } from "@signalco/ui-primitives/Table";
import { NoDataPlaceholder } from "../shared/placeholders/NoDataPlaceholder";
import { LocalDateTime } from "@gredice/ui/LocalDateTime";
import { RaisedBedFieldPlantStatusSelector } from "../../app/admin/raised-beds/[raisedBedId]/RaisedBedFieldPlantStatusSelector";
import { EntityStandardized } from "../../lib/@types/EntityStandardized";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";

interface RaisedBedFieldsTableProps {
    raisedBedId: number;
}

export async function RaisedBedFieldsTable({ raisedBedId }: RaisedBedFieldsTableProps) {
    const sortsData = await getEntitiesFormatted<EntityStandardized>('plantSort');
    const raisedBed = await getRaisedBed(raisedBedId);
    const fields = raisedBed?.fields;

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>Lokacija</Table.Head>
                    <Table.Head>Biljka</Table.Head>
                    <Table.Head>Status</Table.Head>
                    <Table.Head>Datumi</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {fields?.length === 0 && (
                    <Table.Row>
                        <Table.Cell colSpan={4}>
                            <NoDataPlaceholder />
                        </Table.Cell>
                    </Table.Row>
                )}
                {fields?.sort((fa, fb) => fa.positionIndex - fb.positionIndex).map((field) => {
                    const sortData = sortsData?.find(sort => sort.id === field.plantSortId);
                    return (
                        <Table.Row key={field.id}>
                            <Table.Cell>{field.positionIndex + 1}</Table.Cell>
                            <Table.Cell>{sortData?.information?.name}</Table.Cell>
                            <Table.Cell>
                                {field.plantStatus ? (
                                    <RaisedBedFieldPlantStatusSelector
                                        raisedBedId={raisedBedId}
                                        positionIndex={field.positionIndex}
                                        status={field.plantStatus} />
                                ) : '-'}
                            </Table.Cell>
                            <Table.Cell>
                                <Stack>
                                    <Row>
                                        <Typography level="body3" className="w-16">Stvoreno</Typography>
                                        <LocalDateTime time={false}>{field.createdAt}</LocalDateTime>
                                    </Row>
                                    <Row>
                                        <Typography level="body3" className="w-16">Planirano</Typography>
                                        {field.plantScheduledDate ? (
                                            <LocalDateTime time={false}>{new Date(field.plantScheduledDate)}</LocalDateTime>
                                        ) : '-'}
                                    </Row>
                                    <Row>
                                        <Typography level="body3" className="w-16">Sijano</Typography>
                                        {field.plantSowDate ? (
                                            <LocalDateTime time={false}>{new Date(field.plantSowDate)}</LocalDateTime>
                                        ) : '-'}
                                    </Row>
                                    <Row>
                                        <Typography level="body3" className="w-16">Proklijalo</Typography>
                                        {field.plantGrowthDate ? (
                                            <LocalDateTime time={false}>{new Date(field.plantGrowthDate)}</LocalDateTime>
                                        ) : '-'}
                                    </Row>
                                    <Row>
                                        <Typography level="body3" className="w-16">Spremno</Typography>
                                        {field.plantReadyDate ? (
                                            <LocalDateTime time={false}>{new Date(field.plantReadyDate)}</LocalDateTime>
                                        ) : '-'}
                                    </Row>
                                    <Row>
                                        <Typography level="body3" className="w-16">Ubrano</Typography>
                                        {field.plantHarvestedDate ? (
                                            <LocalDateTime time={false}>{new Date(field.plantHarvestedDate)}</LocalDateTime>
                                        ) : '-'}
                                    </Row>
                                    <Row>
                                        <Typography level="body3" className="w-16">Uginulo</Typography>
                                        {field.plantDeadDate ? (
                                            <LocalDateTime time={false}>{new Date(field.plantDeadDate)}</LocalDateTime>
                                        ) : '-'}
                                    </Row>
                                    <Row>
                                        <Typography level="body3" className="w-16">Uklonjeno</Typography>
                                        {field.plantRemovedDate ? (
                                            <LocalDateTime time={false}>{new Date(field.plantRemovedDate)}</LocalDateTime>
                                        ) : '-'}
                                    </Row>
                                </Stack>
                            </Table.Cell>
                        </Table.Row>
                    );
                })}
            </Table.Body>
        </Table>
    );
}
