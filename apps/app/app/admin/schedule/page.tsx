import { getAllOperations, getAllRaisedBeds, getEntitiesFormatted } from "@gredice/storage";
import { EntityStandardized } from "../../../lib/@types/EntityStandardized";
import { Stack } from "@signalco/ui-primitives/Stack";
import { LocaleDateTime } from "../../../components/shared/LocaleDateTime";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Checkbox } from "@signalco/ui-primitives/Checkbox";
import { auth } from "../../../lib/auth/auth";
import { completeOperationAction } from "../../(actions)/operationActions";
import { raisedBedPlantedFormHandler } from "../../(actions)/raisedBedFieldsActions";
import { Accordion } from "@signalco/ui/Accordion";
import { Fragment } from "react";
import { Row } from "@signalco/ui-primitives/Row";
import { Divider } from "@signalco/ui-primitives/Divider";
import Link from "next/link";
import { KnownPages } from "../../../src/KnownPages";
import { CopyTasksButton } from "./CopyTasksButton";
import { Tally3, Calendar } from "@signalco/ui-icons";
import { Button } from "@signalco/ui-primitives/Button";
import { RescheduleOperationModal } from "./RescheduleOperationModal";

export const dynamic = 'force-dynamic';

function getDaySchedule(isToday: boolean, date: Date, raisedBeds: Awaited<ReturnType<typeof getAllRaisedBeds>>, operations: Awaited<ReturnType<typeof getAllOperations>>) {
    const todaysNewFields = raisedBeds.flatMap(rb => rb.fields).filter(field =>
        (field.plantStatus === 'new' || field.plantStatus === 'planned') &&
        ((!field.plantScheduledDate && isToday) ||
            (field.plantScheduledDate && (
                date.toDateString() === new Date(field.plantScheduledDate).toDateString() || // For specific scheduled date
                date > new Date(field.plantScheduledDate) && isToday
            ))));
    const todaysNewOperations = operations.filter(op =>
        (op.status === 'new' || op.status === 'planned') &&
        ((!op.scheduledDate && isToday) ||
            (op.scheduledDate && (
                date.toDateString() === new Date(op.scheduledDate).toDateString() || // For specific scheduled date
                date > new Date(op.scheduledDate) && isToday
            ))));

    // Get unique raisedBedIds from new operations and fields
    const todayAffectedRaisedBedIds = [...new Set([
        ...todaysNewOperations.map(op => op.raisedBedId),
        ...todaysNewFields.map(field => field.raisedBedId)
    ])];

    // Unique physical IDs from raised beds from the new operations and fields
    const physicalIds = [...new Set([
        ...raisedBeds
            .filter(rb => todayAffectedRaisedBedIds.includes(rb.id))
            .map(rb => rb.physicalId)
            .filter(id => id !== null),
    ])].sort((a, b) => Number(a) - Number(b));

    return {
        newFields: todaysNewFields,
        newOperations: todaysNewOperations,
        affectedRaisedBedPhysicalIds: physicalIds,
    }
}

async function ScheduleDay({ isToday, date, allRaisedBeds, operations, plantSorts, operationsData }: {
    isToday: boolean,
    date: Date,
    allRaisedBeds: Awaited<ReturnType<typeof getAllRaisedBeds>>,
    operations: Awaited<ReturnType<typeof getAllOperations>>,
    plantSorts: Awaited<ReturnType<typeof getEntitiesFormatted<EntityStandardized>>>,
    operationsData: Awaited<ReturnType<typeof getEntitiesFormatted<EntityStandardized>>>
}) {
    const { userId } = await auth(["admin"]);
    const { newFields, newOperations, affectedRaisedBedPhysicalIds } = getDaySchedule(isToday, date, allRaisedBeds, operations);

    return (
        <Stack className="grow">
            {(!affectedRaisedBedPhysicalIds.length) && (
                <Typography level="body2" className="leading-[56px]">Trenutno nema zadataka za ovaj dan.</Typography>
            )}
            {affectedRaisedBedPhysicalIds.map((physicalId) => {
                const raisedBeds = allRaisedBeds
                    .filter(rb => rb.physicalId === physicalId)
                    .sort((a, b) => a.id - b.id);

                const dayFields = newFields
                    .filter(field => raisedBeds.some(rb => rb.id === field.raisedBedId))
                    .map((field) => ({
                        ...field,
                        physicalPositionIndex: raisedBeds.at(0)?.fields.find(f => f.id === field.id) ? field.positionIndex + 1 : field.positionIndex + 10
                    }))
                    .sort((a, b) => a.physicalPositionIndex - b.physicalPositionIndex);
                const dayOperations = newOperations
                    .filter(op => raisedBeds.some(rb => rb.id === op.raisedBedId))
                    .map((op) => {
                        const isFirstRaisedBed = op.raisedBedId === raisedBeds.at(0)?.id;
                        const field = op.raisedBedFieldId
                            ? raisedBeds
                                .flatMap(rb => rb.fields)
                                .find(rbf => rbf.id === op.raisedBedFieldId)
                            : undefined;

                        const physicalPositionIndex = field
                            ? (field.positionIndex + 1).toString()
                            : (isFirstRaisedBed
                                ? '1-9'
                                : '10-18');

                        return {
                            ...op,
                            physicalPositionIndex,
                        };
                    })
                    .sort((a, b) => a.physicalPositionIndex.localeCompare(b.physicalPositionIndex, undefined, { numeric: true }));

                // Prepare tasks for copy functionality
                const copyTasks = [
                    ...dayFields.map((field) => {
                        const sortData = plantSorts?.find(ps => ps.id === field.plantSortId);
                        const numberOfPlants = Math.pow(Math.floor(30 / (sortData?.information?.plant?.attributes?.seedingDistance || 30)), 2);
                        return {
                            id: `field-${field.id}`,
                            text: `${field.physicalPositionIndex} - sijanje: ${numberOfPlants} ${field.plantSortId ? `${sortData?.information?.name}` : '?'}`,
                        };
                    }),
                    ...dayOperations.map((op) => {
                        const operationData = operationsData?.find(data => data.id === op.entityId);
                        return {
                            id: `operation-${op.id}`,
                            text: `${op.physicalPositionIndex} - ${operationData?.information?.label ?? op.entityId}`,
                            link: operationData?.information?.label ? KnownPages.GrediceOperation(operationData?.information?.label) : KnownPages.GrediceOperations,
                        };
                    })
                ];

                return (
                    <Accordion key={physicalId} defaultOpen={isToday} variant="plain" className="hover:bg-muted">
                        <Row spacing={1}>
                            <Tally3 className="size-5 rotate-90 mt-1" />
                            <Typography level="h5" component="p"><strong>Gr {physicalId}</strong></Typography>
                            {copyTasks.length > 0 && (
                                <CopyTasksButton
                                    physicalId={physicalId.toString()}
                                    tasks={copyTasks}
                                />
                            )}
                        </Row>
                        <Stack spacing={1}>
                            {(!dayFields.length && !dayOperations.length) && (
                                <Typography level="body2">Trenutno nema zadataka za ovu gredicu.</Typography>
                            )}
                            {dayFields.map((field) => {
                                const sortData = plantSorts?.find(ps => ps.id === field.plantSortId);
                                const numberOfPlants = Math.pow(Math.floor(30 / (sortData?.information?.plant?.attributes?.seedingDistance || 30)), 2);

                                return (
                                    <div key={field.id}>
                                        <form action={raisedBedPlantedFormHandler} className="w-fit">
                                            <input type="hidden" name="raisedBedId" value={field.raisedBedId} />
                                            <input type="hidden" name="positionIndex" value={field.positionIndex} />
                                            <Row spacing={1}>
                                                <Checkbox type="submit" />
                                                <Typography>
                                                    {`${field.physicalPositionIndex} - sijanje: ${numberOfPlants} ${field.plantSortId ? `${sortData?.information?.name}` : '?'}`}
                                                </Typography>
                                            </Row>
                                        </form>
                                    </div>
                                );
                            })}
                            {dayOperations.map((op) => {
                                const operationData = operationsData?.find(data => data.id === op.entityId);
                                return (
                                    <div key={op.id}>
                                        <Row spacing={1} alignItems="start">
                                            <form action={completeOperationAction} className="w-fit">
                                                <input type="hidden" name="operationId" value={op.id} />
                                                <input type="hidden" name="completedBy" value={userId} />
                                                <Row spacing={1}>
                                                    <Checkbox type="submit" />
                                                    <Link
                                                        href={operationData?.information?.label ? KnownPages.GrediceOperation(operationData?.information?.label) : KnownPages.GrediceOperations}
                                                        target="_blank">
                                                        <Typography>{`${op.physicalPositionIndex} - ${operationData?.information?.label ?? op.entityId}`}</Typography>
                                                    </Link>
                                                </Row>
                                            </form>
                                            <Row spacing={1} alignItems="center">
                                                {op.scheduledDate && (
                                                    <Typography level="body2" className="select-none">
                                                        <LocaleDateTime time={false}>{op.scheduledDate}</LocaleDateTime>
                                                    </Typography>
                                                )}
                                                <RescheduleOperationModal
                                                    operation={{
                                                        id: op.id,
                                                        entityId: op.entityId,
                                                        scheduledDate: op.scheduledDate
                                                    }}
                                                    operationLabel={operationData?.information?.label ?? op.entityId.toString()}
                                                    trigger={
                                                        <Button
                                                            variant="plain"
                                                            size="sm"
                                                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                                            title={op.scheduledDate ? "Prerasporedi operaciju" : "Zakaži operaciju"}
                                                        >
                                                            <Calendar className="size-3" />
                                                        </Button>
                                                    }
                                                />
                                            </Row>
                                        </Row>
                                    </div>
                                );
                            })}
                        </Stack>
                    </Accordion>
                );
            })}
        </Stack>
    )
}

export default async function AdminSchedulePage() {
    await auth(['admin']);
    const [allRaisedBeds, operations, plantSorts, operationsData] = await Promise.all([
        getAllRaisedBeds(),
        getAllOperations(),
        getEntitiesFormatted<EntityStandardized>('plantSort'),
        getEntitiesFormatted<EntityStandardized>('operation'),
    ]);
    const dates = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setHours(0, 0, 0, 0); // Reset time to midnight
        date.setDate(date.getDate() + i);
        return date;
    });

    return (
        <Stack spacing={2}>
            <Typography level="h4" component="h1">Rasprored</Typography>
            <Stack spacing={2}>
                {dates.map((date, dateIndex) => {
                    return (
                        <Fragment key={date.toISOString()}>
                            <div className="flex flex-col md:flex-row gap-x-4 gap-y-2">
                                <Row spacing={1}>
                                    <Calendar className="size-5 shrink-0 ml-2 mb-1" />
                                    <Stack>
                                        <Typography level="body2">
                                            <LocaleDateTime time={false}>{date}</LocaleDateTime>
                                        </Typography>
                                        <Typography level="body1" uppercase semiBold={dateIndex !== 0} bold={dateIndex === 0}>
                                            {dateIndex === 0 ? 'Danas' : new Intl.DateTimeFormat('hr-HR', { weekday: 'long' }).format(date).substring(0, 3)}
                                        </Typography>
                                    </Stack>
                                </Row>
                                <ScheduleDay
                                    isToday={dateIndex === 0}
                                    date={date}
                                    allRaisedBeds={allRaisedBeds}
                                    operations={operations}
                                    plantSorts={plantSorts}
                                    operationsData={operationsData} />
                            </div>
                            <Divider />
                        </Fragment>
                    );
                })}
            </Stack>
        </Stack>
    );
}