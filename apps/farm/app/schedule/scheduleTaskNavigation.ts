import type { Route } from 'next';
import {
    getScheduleTaskAnchorId,
    type ScheduleTaskKind,
} from './scheduleTaskIds';

type ScheduleContextParam = string | string[] | undefined;
const calendarDateKeyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function isScheduleCalendarDateKey(dateKey: string) {
    const match = calendarDateKeyPattern.exec(dateKey);
    if (!match) {
        return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

export function buildScheduleTaskGuidanceHref({
    dateKey,
    guidancePath,
    taskId,
}: {
    dateKey: string;
    guidancePath: string;
    taskId: number;
}) {
    const searchParams = new URLSearchParams({
        scheduleDate: dateKey,
        scheduleTask: taskId.toString(),
    });

    return `${guidancePath}?${searchParams.toString()}` as Route;
}

function parseTaskId(taskId: ScheduleContextParam) {
    if (typeof taskId !== 'string' || !/^[1-9]\d*$/.test(taskId)) {
        return null;
    }

    const parsedTaskId = Number(taskId);
    return Number.isSafeInteger(parsedTaskId) && parsedTaskId > 0
        ? parsedTaskId
        : null;
}

export function getScheduleTaskReturnHref({
    dateKey,
    kind,
    taskId,
}: {
    dateKey: ScheduleContextParam;
    kind: ScheduleTaskKind;
    taskId: ScheduleContextParam;
}) {
    const parsedTaskId = parseTaskId(taskId);
    if (
        typeof dateKey !== 'string' ||
        !isScheduleCalendarDateKey(dateKey) ||
        parsedTaskId === null
    ) {
        return null;
    }

    const anchorId = getScheduleTaskAnchorId(kind, parsedTaskId);
    return `/schedule?date=${encodeURIComponent(dateKey)}#${anchorId}` as Route;
}
