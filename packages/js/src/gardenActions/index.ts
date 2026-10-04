export type GardenAction =
    | { type: 'sow'; plantId: number; sortId?: number }
    | { type: 'operation'; operationId: number };

export const gardenActionQueryKeys = ['sijanje', 'sorta', 'radnja'];

export function isGardenOperationApplication(
    application: string | null | undefined,
) {
    return (
        typeof application === 'string' &&
        ['garden', 'raisedBedFull', 'raisedBed1m', 'plant'].includes(
            application,
        )
    );
}

function readId(value: string | null) {
    if (!value || !/^[1-9]\d*$/u.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
}

export function readGardenAction(query: URLSearchParams): GardenAction | null {
    if (gardenActionQueryKeys.some((key) => query.getAll(key).length > 1)) {
        return null;
    }
    const plantId = readId(query.get('sijanje'));
    const sortId = readId(query.get('sorta'));
    const operationId = readId(query.get('radnja'));
    if (query.has('radnja')) {
        return operationId && !query.has('sijanje') && !query.has('sorta')
            ? { type: 'operation', operationId }
            : null;
    }
    return plantId && (!query.has('sorta') || sortId)
        ? { type: 'sow', plantId, ...(sortId ? { sortId } : {}) }
        : null;
}

export function gardenActionPath(action: GardenAction): `/?${string}` {
    const query = new URLSearchParams();
    if (action.type === 'sow') {
        query.set('sijanje', action.plantId.toString());
        if (action.sortId) query.set('sorta', action.sortId.toString());
    } else {
        query.set('radnja', action.operationId.toString());
    }
    return `/?${query.toString()}`;
}

export function gardenActionUrl(origin: string, action: GardenAction) {
    return new URL(gardenActionPath(action), origin).toString();
}
