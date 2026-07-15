import type { ScheduleTaskBlockReasonCode as StorageScheduleTaskBlockReasonCode } from '@gredice/storage';

type StorageScheduleTaskBlockReason = {
    [Code in StorageScheduleTaskBlockReasonCode]: {
        code: Code;
        label: typeof import('@gredice/storage').scheduleTaskBlockReasons[Code];
    };
}[StorageScheduleTaskBlockReasonCode];

export const scheduleTaskBlockerReasons = [
    {
        code: 'unsafe_conditions',
        label: 'Vrijeme ili uvjeti nisu sigurni',
    },
    {
        code: 'missing_materials',
        label: 'Nedostaje materijal ili oprema',
    },
    {
        code: 'location_not_ready',
        label: 'Biljka, gredica ili lokacija nije spremna',
    },
    {
        code: 'location_inaccessible',
        label: 'Ne mogu pristupiti lokaciji',
    },
    {
        code: 'task_not_applicable',
        label: 'Zadatak ili upute nisu primjenjivi',
    },
    {
        code: 'other',
        label: 'Drugi razlog',
    },
] as const satisfies readonly StorageScheduleTaskBlockReason[];

export type ScheduleTaskBlockerReasonCode = StorageScheduleTaskBlockReasonCode;

export type ScheduleTaskBlockerTarget =
    | {
          expectedEntityId: number;
          expectedTaskVersionEventId: number;
          kind: 'operation';
          operationId: number;
      }
    | {
          expectedPlantCycleEventId: number;
          expectedPlantCycleVersionEventId: number;
          expectedPlantSortId: number;
          kind: 'planting';
          positionIndex: number;
          raisedBedId: number;
      };

function assertPositiveSafeInteger(value: unknown, message: string) {
    if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value <= 0
    ) {
        throw new Error(message);
    }

    return value;
}

function assertNonNegativeSafeInteger(value: unknown, message: string) {
    if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < 0
    ) {
        throw new Error(message);
    }

    return value;
}

export function parseScheduleTaskBlockerTarget(
    value: unknown,
): ScheduleTaskBlockerTarget {
    if (!value || typeof value !== 'object') {
        throw new Error('Zadatak za prijavu prepreke nije ispravan.');
    }

    const kind = Reflect.get(value, 'kind');
    if (kind === 'operation') {
        return {
            expectedEntityId: assertPositiveSafeInteger(
                Reflect.get(value, 'expectedEntityId'),
                'ID vrste radnje nije ispravan.',
            ),
            expectedTaskVersionEventId: assertNonNegativeSafeInteger(
                Reflect.get(value, 'expectedTaskVersionEventId'),
                'Verzija radnje nije ispravna.',
            ),
            kind,
            operationId: assertPositiveSafeInteger(
                Reflect.get(value, 'operationId'),
                'ID radnje nije ispravan.',
            ),
        };
    }
    if (kind === 'planting') {
        return {
            expectedPlantCycleEventId: assertPositiveSafeInteger(
                Reflect.get(value, 'expectedPlantCycleEventId'),
                'ID ciklusa biljke nije ispravan.',
            ),
            expectedPlantCycleVersionEventId: assertPositiveSafeInteger(
                Reflect.get(value, 'expectedPlantCycleVersionEventId'),
                'Verzija ciklusa biljke nije ispravna.',
            ),
            expectedPlantSortId: assertPositiveSafeInteger(
                Reflect.get(value, 'expectedPlantSortId'),
                'ID sorte biljke nije ispravan.',
            ),
            kind,
            raisedBedId: assertPositiveSafeInteger(
                Reflect.get(value, 'raisedBedId'),
                'ID gredice nije ispravan.',
            ),
            positionIndex: assertNonNegativeSafeInteger(
                Reflect.get(value, 'positionIndex'),
                'Pozicija sijanja nije ispravna.',
            ),
        };
    }

    throw new Error('Vrsta zadatka za prijavu prepreke nije ispravna.');
}

const blockerReasonByCode = new Map<
    string,
    (typeof scheduleTaskBlockerReasons)[number]
>(scheduleTaskBlockerReasons.map((reason) => [reason.code, reason]));

export function getScheduleTaskBlockerReason(
    value: unknown,
): (typeof scheduleTaskBlockerReasons)[number] {
    if (typeof value !== 'string') {
        throw new Error('Odaberi razlog zbog kojeg zadatak nije dovršen.');
    }

    const reason = blockerReasonByCode.get(value);
    if (!reason) {
        throw new Error('Odabrani razlog nije ispravan.');
    }

    return reason;
}

export function scheduleTaskBlockerReasonRequiresNote(
    code: ScheduleTaskBlockerReasonCode,
) {
    return code === 'task_not_applicable' || code === 'other';
}

export function getScheduleTaskBlockerTargetKey(
    target: ScheduleTaskBlockerTarget,
) {
    return target.kind === 'operation'
        ? `operation-${target.operationId}-entity-${target.expectedEntityId}-version-${target.expectedTaskVersionEventId}`
        : `planting-${target.raisedBedId}-${target.positionIndex}-cycle-${target.expectedPlantCycleEventId}-version-${target.expectedPlantCycleVersionEventId}-sort-${target.expectedPlantSortId}`;
}

export function getScheduleTaskBlockerTargetLabel(
    target: ScheduleTaskBlockerTarget,
) {
    return target.kind === 'operation' ? 'radnju' : 'sijanje';
}
