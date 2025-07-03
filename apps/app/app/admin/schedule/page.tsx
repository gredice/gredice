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
        ...raisedBeds.filter(rb => todayAffectedRaisedBedIds.includes(rb.id)).map(rb => rb.physicalId).filter(id => id !== null),
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
                    .sort((a, b) => a.id - b.id);

                return (
                    <Accordion key={physicalId} defaultOpen={isToday} variant="plain" className="hover:bg-muted">
                        <Row spacing={1}>
                            <div className="rounded-full border-2 bg-background border-neutral-500 size-[19px]" />
                            <Typography level="body1" className="text-lg"><strong>Gr {physicalId}</strong></Typography>
                        </Row>
                        <Stack spacing={1}>
                            {(!dayFields.length && !dayOperations.length) && (
                                <Typography level="body2">Trenutno nema zadataka za ovu gredicu.</Typography>
                            )}
                            {dayFields.map((field) => {
                                const sort = plantSorts?.find(ps => ps.id === field.plantSortId);
                                const numberOfPlants = Math.pow(Math.floor(30 / (sort?.information?.plant?.attributes?.seedingDistance || 30)), 2);

                                return (
                                    <div key={field.id}>
                                        <form action={raisedBedPlantedFormHandler} className="w-fit">
                                            <input type="hidden" name="raisedBedId" value={field.raisedBedId} />
                                            <input type="hidden" name="positionIndex" value={field.positionIndex} />
                                            <Row spacing={1}>
                                                <Checkbox type="submit" />
                                                <Typography>
                                                    {`${field.physicalPositionIndex} - sijanje: ${numberOfPlants} ${field.plantSortId ? `${sort?.information?.name}` : '?'}`}
                                                </Typography>
                                            </Row>
                                        </form>
                                    </div>
                                );
                            })}
                            {dayOperations.map((op) => {
                                const operationData = operationsData?.find(data => data.id === op.entityId);
                                const isFirstRaisedBed = op.raisedBedId === raisedBeds.at(0)?.id;
                                const field = op.raisedBedFieldId
                                    ? raisedBeds
                                        .flatMap(rb => rb.fields)
                                        .find(rbf => rbf.id === op.raisedBedFieldId)
                                    : undefined;

                                const positionIndexes = field
                                    ? (field.positionIndex + 1).toString()
                                    : (isFirstRaisedBed
                                        ? '1-9'
                                        : '10-18');
                                return (
                                    <div key={op.id}>
                                        <form action={completeOperationAction} className="w-fit">
                                            <input type="hidden" name="operationId" value={op.id} />
                                            <input type="hidden" name="completedBy" value={userId} />
                                            <Row spacing={1}>
                                                <Checkbox type="submit" />
                                                <Typography>{`${positionIndexes} - ${operationData?.information?.label ?? op.entityId}`}</Typography>
                                            </Row>
                                        </form>
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
    const [allRaisedBeds, operations, plantSorts, operationsData] = await Promise.all([
        getAllRaisedBeds(),
        getAllOperations(),
        getEntitiesFormatted<EntityStandardized>('plantSort'),
        getEntitiesFormatted<EntityStandardized>('operation'),
    ]);
    const dates = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        return date;
    });

    return (
        <Stack spacing={2}>
            <Typography level="h4" component="h1">Rasprored operacija</Typography>
            <Stack spacing={2}>
                {dates.map((date, dateIndex) => {
                    return (
                        <Fragment key={date.toISOString()}>
                            <Row spacing={4} alignItems="start">
                                <Stack className="pt-[18px]">
                                    <Typography level="body2">
                                        <LocaleDateTime time={false}>{date}</LocaleDateTime>
                                    </Typography>
                                    <Typography level="body1" uppercase semiBold={dateIndex !== 0} bold={dateIndex === 0}>
                                        {dateIndex === 0 ? 'Danas' : new Intl.DateTimeFormat('hr-HR', { weekday: 'long' }).format(date).substring(0, 3)}
                                    </Typography>
                                </Stack>
                                <ScheduleDay
                                    isToday={dateIndex === 0}
                                    date={date}
                                    allRaisedBeds={allRaisedBeds}
                                    operations={operations}
                                    plantSorts={plantSorts}
                                    operationsData={operationsData} />
                            </Row>
                            <Divider />
                        </Fragment>
                    );
                })}
            </Stack>
        </Stack>
    );
}