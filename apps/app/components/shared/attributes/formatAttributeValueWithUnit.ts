export function formatAttributeValueWithUnit(
    value: string,
    unit?: string | null,
) {
    return unit ? `${value} ${unit}` : value;
}
