export type DeliveryMapCoordinate = {
    latitude: number;
    longitude: number;
};

export type DeliveryMapNode = DeliveryMapCoordinate & {
    selectionId: string | null;
};

export type DeliveryMapStop = DeliveryMapNode & {
    sequence: number;
};

export type DeliveryMapData = {
    driverLocation: DeliveryMapCoordinate | null;
    pickupNodes: DeliveryMapNode[];
    stops: DeliveryMapStop[];
    encodedPolyline: string | null;
};

export type DeliveryMapPosition = {
    lat: number;
    lng: number;
};

export type DeliveryMapSelection =
    | { kind: 'pickup'; id: string }
    | { kind: 'delivery'; id: string };

export function deliveryMapAudience({
    role,
    userId,
    driverUserId,
}: {
    role: string;
    userId: string;
    driverUserId: string | null;
}) {
    return (role === 'driver' || role === 'admin') && userId === driverUserId
        ? 'driver'
        : 'customer';
}

export function customerCurrentDeliveryMapStops({
    accountId,
    groups,
    currentDeliveryStopIds,
}: {
    accountId: string;
    groups: ReadonlyArray<{
        items: ReadonlyArray<{
            stop: {
                id: number;
                latitude: number;
                longitude: number;
            };
            request?: { accountId?: string | null };
        }>;
    }>;
    currentDeliveryStopIds: ReadonlySet<number>;
}): DeliveryMapStop[] {
    const currentGroup = groups.find((group) =>
        group.items.some(({ stop }) => currentDeliveryStopIds.has(stop.id)),
    );
    if (
        !currentGroup?.items.some(
            ({ stop, request }) =>
                currentDeliveryStopIds.has(stop.id) &&
                request?.accountId === accountId,
        )
    ) {
        return [];
    }
    const representative = currentGroup.items.find(
        ({ stop, request }) =>
            currentDeliveryStopIds.has(stop.id) &&
            request?.accountId === accountId,
    )?.stop;
    return representative
        ? [
              {
                  latitude: representative.latitude,
                  longitude: representative.longitude,
                  sequence: 1,
                  selectionId: null,
              },
          ]
        : [];
}

export function deliveryMapSelectionKey(
    selection: DeliveryMapSelection | null,
) {
    if (!selection) return null;
    return `${selection.kind}:${selection.id}`;
}

export function deliveryMapStopGroupSelectionId(stopIds: readonly number[]) {
    const uniqueStopIds = [...new Set(stopIds)]
        .filter((stopId) => Number.isInteger(stopId) && stopId > 0)
        .sort((first, second) => first - second);
    return uniqueStopIds[0]?.toString() ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parseCoordinate(value: unknown): DeliveryMapCoordinate | null {
    if (!isRecord(value)) return null;
    const { latitude, longitude } = value;
    if (
        typeof latitude !== 'number' ||
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        typeof longitude !== 'number' ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
    ) {
        return null;
    }
    return { latitude, longitude };
}

function parseNode(value: unknown): DeliveryMapNode | null {
    const coordinate = parseCoordinate(value);
    if (!coordinate || !isRecord(value)) return null;
    const { selectionId } = value;
    if (
        selectionId !== null &&
        (typeof selectionId !== 'string' ||
            selectionId.length === 0 ||
            selectionId.length > 512)
    ) {
        return null;
    }
    return { ...coordinate, selectionId };
}

function parseStop(value: unknown): DeliveryMapStop | null {
    const node = parseNode(value);
    if (!node || !isRecord(value)) return null;
    const { sequence } = value;
    if (
        typeof sequence !== 'number' ||
        !Number.isInteger(sequence) ||
        sequence < 1
    ) {
        return null;
    }
    return { ...node, sequence };
}

function parseArray<T>(
    value: unknown,
    parseItem: (item: unknown) => T | null,
): T[] | null {
    if (!Array.isArray(value)) return null;
    const result: T[] = [];
    for (const item of value) {
        const parsed = parseItem(item);
        if (!parsed) return null;
        result.push(parsed);
    }
    return result;
}

export function parseDeliveryMapData(value: unknown): DeliveryMapData | null {
    if (!isRecord(value)) return null;
    const driverLocation =
        value.driverLocation === null
            ? null
            : parseCoordinate(value.driverLocation);
    const pickupNodes = parseArray(value.pickupNodes, parseNode);
    const stops = parseArray(value.stops, parseStop);
    const encodedPolyline = value.encodedPolyline;
    if (
        (value.driverLocation !== null && !driverLocation) ||
        !pickupNodes ||
        !stops ||
        (typeof encodedPolyline !== 'string' && encodedPolyline !== null)
    ) {
        return null;
    }
    return { driverLocation, pickupNodes, stops, encodedPolyline };
}

export function buildDeliveryMapData({
    driverLocation,
    pickupNodes,
    stops,
    encodedPolyline,
    customerView,
}: {
    driverLocation: DeliveryMapCoordinate | null;
    pickupNodes: DeliveryMapNode[];
    stops: DeliveryMapStop[];
    encodedPolyline?: string | null;
    customerView: boolean;
}): DeliveryMapData {
    return {
        driverLocation,
        pickupNodes: customerView ? [] : pickupNodes,
        stops: customerView
            ? stops.map((stop) => ({ ...stop, selectionId: null }))
            : stops,
        encodedPolyline: customerView ? null : (encodedPolyline ?? null),
    };
}

function decodePolylineValue(
    encodedPolyline: string,
    startIndex: number,
): { value: number; nextIndex: number } | null {
    let index = startIndex;
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
        if (index >= encodedPolyline.length || shift > 30) return null;
        byte = encodedPolyline.charCodeAt(index) - 63;
        if (byte < 0 || byte > 63) return null;
        result |= (byte & 0x1f) << shift;
        shift += 5;
        index += 1;
    } while (byte >= 0x20);
    return {
        value: result & 1 ? ~(result >> 1) : result >> 1,
        nextIndex: index,
    };
}

export function decodeDeliveryMapPolyline(
    encodedPolyline: string,
): DeliveryMapPosition[] {
    const positions: DeliveryMapPosition[] = [];
    let index = 0;
    let latitude = 0;
    let longitude = 0;
    while (index < encodedPolyline.length) {
        const latitudeDelta = decodePolylineValue(encodedPolyline, index);
        if (!latitudeDelta) return [];
        const longitudeDelta = decodePolylineValue(
            encodedPolyline,
            latitudeDelta.nextIndex,
        );
        if (!longitudeDelta) return [];
        latitude += latitudeDelta.value;
        longitude += longitudeDelta.value;
        positions.push({
            lat: latitude / 1e5,
            lng: longitude / 1e5,
        });
        index = longitudeDelta.nextIndex;
    }
    return positions;
}
