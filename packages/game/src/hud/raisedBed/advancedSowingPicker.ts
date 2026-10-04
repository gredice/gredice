import {
    type AdvancedSowingCartConfigurationV1,
    type AdvancedSowingDistanceRange,
    type AdvancedSowingLayoutOption,
    buildAdvancedSowingCartConfigurationV1,
    getAdvancedSowingLayoutOptions,
    resolveAdvancedSowingDistanceRange,
} from '@gredice/js/plants';

export type AdvancedSowingPickerOption = {
    layout: AdvancedSowingLayoutOption;
    plan: AdvancedSowingCartConfigurationV1 | null;
};

export type AdvancedSowingPickerPreview =
    | { status: 'unsupported' }
    | { status: 'invalid' }
    | {
          status: 'supported';
          distanceRange: AdvancedSowingDistanceRange;
          options: AdvancedSowingPickerOption[];
      };

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function optionalDistanceAttribute(
    attributes: Record<string, unknown>,
    name: 'seedingDistanceMax' | 'seedingDistanceMin',
) {
    const value = attributes[name];
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value !== 'number') {
        throw new TypeError(`${name} must be numeric.`);
    }
    return value;
}

export function readAdvancedSowingDistanceRange(
    attributes: unknown,
): AdvancedSowingDistanceRange | null {
    if (!isRecord(attributes)) {
        return null;
    }

    const minDistanceCm = optionalDistanceAttribute(
        attributes,
        'seedingDistanceMin',
    );
    const maxDistanceCm = optionalDistanceAttribute(
        attributes,
        'seedingDistanceMax',
    );
    if (minDistanceCm === null && maxDistanceCm === null) {
        return null;
    }

    const optimalDistanceCm = attributes.seedingDistance;
    if (typeof optimalDistanceCm !== 'number') {
        throw new TypeError('seedingDistance must be numeric.');
    }

    return resolveAdvancedSowingDistanceRange({
        maxDistanceCm,
        minDistanceCm,
        optimalDistanceCm,
    });
}

export function createAdvancedSowingPickerPreview({
    anchorPositionIndex,
    attributes,
    bedFieldCount,
}: {
    anchorPositionIndex: number;
    attributes: unknown;
    bedFieldCount: number;
}): AdvancedSowingPickerPreview {
    try {
        const distanceRange = readAdvancedSowingDistanceRange(attributes);
        if (!distanceRange) {
            return { status: 'unsupported' };
        }

        const options = getAdvancedSowingLayoutOptions(distanceRange, {
            bedFieldCount,
        }).map((layout): AdvancedSowingPickerOption => {
            try {
                return {
                    layout,
                    plan: buildAdvancedSowingCartConfigurationV1({
                        anchorPositionIndex,
                        bedFieldCount,
                        ...distanceRange,
                        selectedDistanceCm: layout.selectedDistanceCm,
                    }),
                };
            } catch {
                return { layout, plan: null };
            }
        });

        return { distanceRange, options, status: 'supported' };
    } catch {
        return { status: 'invalid' };
    }
}

export function getSelectedAdvancedSowingPickerOption(
    preview: AdvancedSowingPickerPreview,
    selectedLayoutKey: string | null,
    unavailableLayoutKeys: ReadonlySet<string> = new Set(),
) {
    if (preview.status !== 'supported') {
        return null;
    }

    return (
        preview.options.find(
            (option) =>
                option.plan &&
                !unavailableLayoutKeys.has(option.layout.layoutKey) &&
                option.layout.layoutKey === selectedLayoutKey,
        ) ??
        preview.options.find(
            (option) =>
                option.plan &&
                !unavailableLayoutKeys.has(option.layout.layoutKey) &&
                option.layout.isDefault,
        ) ??
        null
    );
}
