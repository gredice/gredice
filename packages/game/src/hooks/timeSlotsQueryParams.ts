export interface TimeSlotsQueryParams {
    type?: 'delivery' | 'pickup';
    from?: string;
    to?: string;
    locationId?: number;
    includeClosed?: boolean;
    includeArchived?: boolean;
}

interface SerializedTimeSlotsQueryParams {
    type?: 'delivery' | 'pickup';
    from?: string;
    to?: string;
    locationId?: string;
    includeClosed?: 'true';
    includeArchived?: 'true';
}

export function serializeTimeSlotsQueryParams(
    params?: TimeSlotsQueryParams,
): SerializedTimeSlotsQueryParams {
    if (!params) {
        return {};
    }

    return {
        type: params.type,
        from: params.from,
        to: params.to,
        locationId: params.locationId?.toString(),
        includeClosed: params.includeClosed ? 'true' : undefined,
        includeArchived: params.includeArchived ? 'true' : undefined,
    };
}
