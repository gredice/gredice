export function parseFeaturedGardenTraceId(value: string | undefined | null) {
    return value &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(
            value,
        )
        ? value
        : null;
}
