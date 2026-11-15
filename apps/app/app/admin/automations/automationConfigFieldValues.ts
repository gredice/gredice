export type AutomationConfigFieldOptionValue = {
    value: string;
    aliases?: string[];
};

export function jsonFieldValue(value: unknown) {
    if (value === undefined) {
        return '';
    }

    try {
        return JSON.stringify(value, null, 2) ?? '';
    } catch {
        return '';
    }
}

export type JsonFieldParseResult =
    | { ok: true; value: unknown }
    | { ok: false; error: string };

export function parseJsonField(value: string): JsonFieldParseResult {
    if (!value.trim()) {
        return { ok: true, value: undefined };
    }

    try {
        return { ok: true, value: JSON.parse(value) };
    } catch (error) {
        return {
            ok: false,
            error:
                error instanceof Error
                    ? `JSON nije valjan: ${error.message}`
                    : 'JSON nije valjan.',
        };
    }
}

function optionMatches(
    option: AutomationConfigFieldOptionValue,
    rawValue: string,
) {
    const normalized = rawValue.toLowerCase();
    return [option.value, ...(option.aliases ?? [])].some(
        (candidate) => candidate.toLowerCase() === normalized,
    );
}

/**
 * Reads a stored multiselect value (array, comma-separated string or single
 * value) into the selected option values, in option order, plus any stored
 * values that match no option or alias.
 */
export function multiselectFieldValue(
    value: unknown,
    options: AutomationConfigFieldOptionValue[],
) {
    const rawValues = Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? value.split(',')
          : value === undefined || value === null
            ? []
            : [value];
    const normalized = rawValues
        .map((rawValue) => String(rawValue).trim())
        .filter(Boolean);
    const selected = options
        .filter((option) =>
            normalized.some((rawValue) => optionMatches(option, rawValue)),
        )
        .map((option) => option.value);
    const unknown = normalized.filter(
        (rawValue) =>
            !options.some((option) => optionMatches(option, rawValue)),
    );

    return { selected, unknown };
}

export function toggleMultiselectFieldValue({
    checked,
    options,
    optionValue,
    selected,
}: {
    checked: boolean;
    options: AutomationConfigFieldOptionValue[];
    optionValue: string;
    selected: string[];
}) {
    const nextSelected = options
        .map((option) => option.value)
        .filter((candidate) =>
            candidate === optionValue ? checked : selected.includes(candidate),
        );

    return nextSelected.length > 0 ? nextSelected : undefined;
}

export function stringFieldValue(value: unknown) {
    return typeof value === 'string' ? value : '';
}

/** Empty inputs clear optional config values instead of storing `''`. */
export function optionalStringFieldValue(value: string) {
    return value.trim() ? value : undefined;
}

/**
 * IANA time zones offered by the runtime, with `UTC` and the stored value
 * kept selectable even when the runtime list omits them.
 */
export function timeZoneFieldOptions(
    currentValue: string,
    supportedTimeZones: readonly string[],
) {
    const timeZones = new Set(supportedTimeZones);
    timeZones.add('UTC');
    if (currentValue) {
        timeZones.add(currentValue);
    }

    return [...timeZones].sort((left, right) => left.localeCompare(right));
}
