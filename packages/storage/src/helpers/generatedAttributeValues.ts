import type { SelectAttributeDefinition } from '../schema';

export const generatedImageUrlDefaultKind = 'generated-image-url';

export type GeneratedImageUrlDefault = {
    kind: typeof generatedImageUrlDefaultKind;
    source: string;
    template: string;
};

type AttributeDefinitionPath = Pick<
    SelectAttributeDefinition,
    'category' | 'name'
>;

export function attributeDefinitionPath(
    definition: AttributeDefinitionPath,
): string {
    return `${definition.category}.${definition.name}`;
}

export function generatedImageUrlDefaultValue(
    config: Omit<GeneratedImageUrlDefault, 'kind'>,
) {
    return JSON.stringify({
        kind: generatedImageUrlDefaultKind,
        source: config.source,
        template: config.template,
    } satisfies GeneratedImageUrlDefault);
}

export function parseGeneratedImageUrlDefaultValue(
    value: string | null | undefined,
): GeneratedImageUrlDefault | null {
    if (!value) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(value);
        if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'kind' in parsed &&
            parsed.kind === generatedImageUrlDefaultKind &&
            'source' in parsed &&
            typeof parsed.source === 'string' &&
            parsed.source.trim().length > 0 &&
            'template' in parsed &&
            typeof parsed.template === 'string' &&
            parsed.template.trim().length > 0
        ) {
            return {
                kind: generatedImageUrlDefaultKind,
                source: parsed.source.trim(),
                template: parsed.template.trim(),
            };
        }
    } catch {
        return null;
    }

    return null;
}

export function imageAttributeValueFromUrl(url: string) {
    return JSON.stringify({ url });
}

export function imageUrlFromAttributeValue(
    value: string | null | undefined,
): string | null {
    if (!value) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(value);
        if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'url' in parsed &&
            typeof parsed.url === 'string'
        ) {
            return parsed.url;
        }
    } catch {
        return null;
    }

    return null;
}

export function generatedImageUrlFromSourceValue(
    config: GeneratedImageUrlDefault,
    sourceValue: string | null | undefined,
) {
    const value = sourceValue?.trim();
    if (!value) {
        return null;
    }

    const encodedValue = encodeURIComponent(value);
    return config.template
        .replaceAll(`{${config.source}}`, value)
        .replaceAll(`{encoded:${config.source}}`, encodedValue)
        .replaceAll('{value}', value)
        .replaceAll('{encodedValue}', encodedValue);
}

export function generatedImageAttributeValue(
    config: GeneratedImageUrlDefault,
    sourceValue: string | null | undefined,
) {
    const url = generatedImageUrlFromSourceValue(config, sourceValue);
    return url ? imageAttributeValueFromUrl(url) : null;
}
