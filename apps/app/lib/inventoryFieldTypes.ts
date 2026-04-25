export type InventoryCustomFieldType =
    | 'text'
    | 'number'
    | 'date'
    | 'boolean'
    | 'select';

export type InventorySelectOption = {
    value: string;
    label: string;
};

const selectPrefix = 'select|';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function normalizeOption(option: unknown): InventorySelectOption | null {
    if (!isRecord(option)) {
        return null;
    }

    const value = option.value;
    const label = option.label;
    if (typeof value !== 'string' || typeof label !== 'string') {
        return null;
    }

    const normalizedValue = value.trim();
    const normalizedLabel = label.trim();
    if (!normalizedValue || !normalizedLabel) {
        return null;
    }

    return {
        value: normalizedValue,
        label: normalizedLabel,
    };
}

function parseOptions(rawOptions: string): InventorySelectOption[] {
    if (!rawOptions) {
        return [];
    }

    try {
        const parsed = JSON.parse(rawOptions) as unknown;
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .map(normalizeOption)
            .filter(
                (option): option is InventorySelectOption => option !== null,
            );
    } catch {
        return [];
    }
}

export function getInventoryFieldType(
    dataType: string,
): InventoryCustomFieldType {
    if (dataType === 'text' || dataType === 'number' || dataType === 'date') {
        return dataType;
    }
    if (dataType === 'boolean') {
        return 'boolean';
    }
    if (dataType.startsWith(selectPrefix)) {
        return 'select';
    }
    return 'text';
}

export function getInventorySelectOptions(
    dataType: string,
): InventorySelectOption[] {
    if (!dataType.startsWith(selectPrefix)) {
        return [];
    }
    return parseOptions(dataType.slice(selectPrefix.length));
}

export function encodeSelectFieldDataType(
    options: InventorySelectOption[],
): string {
    return `${selectPrefix}${JSON.stringify(options)}`;
}

export function parseSelectOptionsInput(
    rawValue: FormDataEntryValue | null,
): InventorySelectOption[] {
    if (typeof rawValue !== 'string') {
        return [];
    }

    const lines = rawValue
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    const options = lines
        .map((line) => {
            const [rawOptionValue, ...labelParts] = line
                .split('|')
                .map((part) => part.trim());
            const rawOptionLabel =
                labelParts.length > 0 ? labelParts.join('|') : rawOptionValue;

            if (!rawOptionValue || !rawOptionLabel) {
                return null;
            }

            return {
                value: rawOptionValue,
                label: rawOptionLabel,
            } satisfies InventorySelectOption;
        })
        .filter((option): option is InventorySelectOption => option !== null);

    const uniqueOptionsMap = new Map(
        options.map((option) => [option.value, option] as const),
    );
    return Array.from(uniqueOptionsMap.values());
}
