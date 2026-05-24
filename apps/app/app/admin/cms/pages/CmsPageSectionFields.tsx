'use client';

import type { CmsPageSectionField } from '@gredice/storage/cmsPageSections';
import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Add, Delete } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useEffect, useRef } from 'react';
import type {
    CmsPageCtaData,
    CmsPageEditableSection,
    CmsPageFeatureData,
    CmsPageSectionData,
} from './CmsPageFormTypes';

type CmsPageSectionFieldsProps = {
    section?: CmsPageEditableSection;
    fields: CmsPageSectionField[];
    fieldErrors: Map<string, string>;
    onChange: (sectionId: string, data: CmsPageSectionData) => void;
};

type CmsPageCtaEditorData = CmsPageCtaData & { id: string };
type CmsPageFeatureEditorData = Omit<CmsPageFeatureData, 'ctas'> & {
    id: string;
    ctas: CmsPageCtaEditorData[];
};

let fallbackIdCounter = 0;

function createEditorId() {
    if (
        typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
    ) {
        return crypto.randomUUID();
    }

    fallbackIdCounter += 1;

    return `cms-editor-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`;
}

function textValue(value: unknown) {
    return typeof value === 'string' ? value : '';
}

function booleanValue(value: unknown) {
    return typeof value === 'boolean' ? value : false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object';
}

function normalizeCtaValues(value: unknown): {
    items: CmsPageCtaEditorData[];
    changed: boolean;
} {
    if (!Array.isArray(value)) {
        return { items: [], changed: false };
    }

    let changed = false;
    const items = value.filter(isRecord).map((item) => {
        const id = textValue(item.id);

        if (!id) {
            changed = true;
        }

        return {
            id: id || createEditorId(),
            label: textValue(item.label),
            href: textValue(item.href),
            iconName: textValue(item.iconName),
            secondary: booleanValue(item.secondary),
        };
    });

    return { items, changed };
}

function ctaValues(value: unknown) {
    return normalizeCtaValues(value).items;
}

function normalizeFeatureValues(value: unknown): {
    items: CmsPageFeatureEditorData[];
    changed: boolean;
} {
    if (!Array.isArray(value)) {
        return { items: [], changed: false };
    }

    let changed = false;
    const items = value.filter(isRecord).map((item) => {
        const id = textValue(item.id);
        const ctas = normalizeCtaValues(item.ctas);

        if (!id || ctas.changed) {
            changed = true;
        }

        return {
            id: id || createEditorId(),
            header: textValue(item.header),
            description: textValue(item.description),
            ctas: ctas.items,
        };
    });

    return { items, changed };
}

function featureValues(value: unknown) {
    return normalizeFeatureValues(value).items;
}

function replaceAt<T>(items: T[], index: number, value: T) {
    return items.map((item, itemIndex) => (itemIndex === index ? value : item));
}

function removeAt<T>(items: T[], index: number) {
    return items.filter((_item, itemIndex) => itemIndex !== index);
}

export function CmsPageSectionFields({
    section,
    fields,
    fieldErrors,
    onChange,
}: CmsPageSectionFieldsProps) {
    const sectionId = section?.id;
    const sectionData = section?.data;
    const normalizedSectionData = useRef<WeakSet<CmsPageSectionData>>(
        new WeakSet(),
    );

    useEffect(() => {
        if (
            !sectionId ||
            !sectionData ||
            normalizedSectionData.current.has(sectionData)
        ) {
            return;
        }

        let changed = false;
        const nextData: CmsPageSectionData = { ...sectionData };

        for (const field of fields) {
            if (field.type === 'cta-list') {
                const ctas = normalizeCtaValues(sectionData[field.key]);

                if (ctas.changed) {
                    changed = true;
                    nextData[field.key] = ctas.items;
                }
            }

            if (field.type === 'feature-list') {
                const features = normalizeFeatureValues(sectionData[field.key]);

                if (features.changed) {
                    changed = true;
                    nextData[field.key] = features.items;
                }
            }
        }

        if (changed) {
            normalizedSectionData.current.add(nextData);
            onChange(sectionId, nextData);
            return;
        }

        normalizedSectionData.current.add(sectionData);
    }, [fields, onChange, sectionData, sectionId]);

    if (!section) {
        return (
            <Typography level="body3" secondary>
                Odaberi sekciju u preview prikazu.
            </Typography>
        );
    }

    const updateData = (data: CmsPageSectionData) => {
        onChange(section.id, data);
    };

    const updateField = (key: string, value: unknown) => {
        updateData({
            ...section.data,
            [key]: value,
        });
    };

    const renderCtas = (
        key: string,
        items: CmsPageCtaEditorData[],
        options: { allowIcon?: boolean; allowSecondary?: boolean },
        updateItems: (items: CmsPageCtaEditorData[]) => void,
    ) => (
        <Stack spacing={3}>
            {items.map((cta, index) => (
                <div
                    className="rounded-md border bg-background p-3"
                    key={`${key}-${cta.id}`}
                >
                    <Stack spacing={3}>
                        <Row spacing={2} className="items-start">
                            <Input
                                fullWidth
                                label="Label"
                                value={cta.label ?? ''}
                                onChange={(event) =>
                                    updateItems(
                                        replaceAt(items, index, {
                                            ...cta,
                                            label: event.target.value,
                                        }),
                                    )
                                }
                            />
                            <Button
                                type="button"
                                variant="plain"
                                color="danger"
                                size="sm"
                                aria-label="Ukloni poveznicu"
                                title="Ukloni poveznicu"
                                onClick={() =>
                                    updateItems(removeAt(items, index))
                                }
                            >
                                <Delete className="size-4" />
                            </Button>
                        </Row>
                        <Input
                            fullWidth
                            label="Href"
                            value={cta.href ?? ''}
                            placeholder="/kontakt"
                            onChange={(event) =>
                                updateItems(
                                    replaceAt(items, index, {
                                        ...cta,
                                        href: event.target.value,
                                    }),
                                )
                            }
                        />
                        {options.allowIcon && (
                            <Input
                                fullWidth
                                label="Ikona"
                                value={cta.iconName ?? ''}
                                placeholder="instagram, facebook, github"
                                onChange={(event) =>
                                    updateItems(
                                        replaceAt(items, index, {
                                            ...cta,
                                            iconName: event.target.value,
                                        }),
                                    )
                                }
                            />
                        )}
                        {options.allowSecondary && (
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    checked={Boolean(cta.secondary)}
                                    type="checkbox"
                                    onChange={(event) =>
                                        updateItems(
                                            replaceAt(items, index, {
                                                ...cta,
                                                secondary: event.target.checked,
                                            }),
                                        )
                                    }
                                />
                                Sekundarni stil
                            </label>
                        )}
                    </Stack>
                </div>
            ))}
            <Button
                type="button"
                variant="outlined"
                size="sm"
                startDecorator={<Add className="size-4" />}
                onClick={() =>
                    updateItems([
                        ...items,
                        { id: createEditorId(), label: '', href: '' },
                    ])
                }
            >
                Dodaj poveznicu
            </Button>
        </Stack>
    );

    return (
        <Stack spacing={4}>
            {fields.map((field) => {
                const error = fieldErrors.get(field.key);

                if (field.type === 'cta-list') {
                    const items = ctaValues(section.data[field.key]);

                    return (
                        <Stack spacing={3} key={field.key}>
                            <Typography level="body2" semiBold>
                                {field.label}
                                {field.required && (
                                    <span className="text-red-600"> *</span>
                                )}
                            </Typography>
                            {field.helperText && (
                                <Typography level="body3" secondary>
                                    {field.helperText}
                                </Typography>
                            )}
                            {renderCtas(
                                field.key,
                                items,
                                {
                                    allowIcon: field.allowIcon,
                                    allowSecondary: field.allowSecondary,
                                },
                                (nextItems) =>
                                    updateField(field.key, nextItems),
                            )}
                            {error && (
                                <Typography
                                    level="body3"
                                    className="text-red-600"
                                >
                                    {error}
                                </Typography>
                            )}
                        </Stack>
                    );
                }

                if (field.type === 'feature-list') {
                    const items = featureValues(section.data[field.key]);

                    return (
                        <Stack spacing={3} key={field.key}>
                            <Typography level="body2" semiBold>
                                {field.label}
                                {field.required && (
                                    <span className="text-red-600"> *</span>
                                )}
                            </Typography>
                            {field.helperText && (
                                <Typography level="body3" secondary>
                                    {field.helperText}
                                </Typography>
                            )}
                            {items.map((feature, index) => (
                                <div
                                    className="rounded-md border bg-background p-3"
                                    key={`${field.key}-${feature.id}`}
                                >
                                    <Stack spacing={3}>
                                        <Row
                                            spacing={2}
                                            className="items-start"
                                        >
                                            <Input
                                                fullWidth
                                                label={field.itemLabel}
                                                value={feature.header ?? ''}
                                                onChange={(event) =>
                                                    updateField(
                                                        field.key,
                                                        replaceAt(
                                                            items,
                                                            index,
                                                            {
                                                                ...feature,
                                                                header: event
                                                                    .target
                                                                    .value,
                                                            },
                                                        ),
                                                    )
                                                }
                                            />
                                            <Button
                                                type="button"
                                                variant="plain"
                                                color="danger"
                                                size="sm"
                                                aria-label="Ukloni stavku"
                                                title="Ukloni stavku"
                                                onClick={() =>
                                                    updateField(
                                                        field.key,
                                                        removeAt(items, index),
                                                    )
                                                }
                                            >
                                                <Delete className="size-4" />
                                            </Button>
                                        </Row>
                                        {!field.allowCtas && (
                                            <label className="space-y-1">
                                                <span className="block text-sm font-medium">
                                                    {field.itemLabel ===
                                                    'Pitanje'
                                                        ? 'Odgovor'
                                                        : 'Opis'}
                                                </span>
                                                <textarea
                                                    value={
                                                        feature.description ??
                                                        ''
                                                    }
                                                    rows={3}
                                                    className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                    onChange={(event) =>
                                                        updateField(
                                                            field.key,
                                                            replaceAt(
                                                                items,
                                                                index,
                                                                {
                                                                    ...feature,
                                                                    description:
                                                                        event
                                                                            .target
                                                                            .value,
                                                                },
                                                            ),
                                                        )
                                                    }
                                                />
                                            </label>
                                        )}
                                        {field.allowCtas &&
                                            renderCtas(
                                                `${field.key}-${feature.id}-ctas`,
                                                feature.ctas ?? [],
                                                { allowSecondary: true },
                                                (nextCtas) =>
                                                    updateField(
                                                        field.key,
                                                        replaceAt(
                                                            items,
                                                            index,
                                                            {
                                                                ...feature,
                                                                ctas: nextCtas,
                                                            },
                                                        ),
                                                    ),
                                            )}
                                    </Stack>
                                </div>
                            ))}
                            <Button
                                type="button"
                                variant="outlined"
                                size="sm"
                                startDecorator={<Add className="size-4" />}
                                onClick={() =>
                                    updateField(field.key, [
                                        ...items,
                                        {
                                            id: createEditorId(),
                                            header: '',
                                            description: '',
                                        },
                                    ])
                                }
                            >
                                Dodaj {field.itemLabel.toLowerCase()}
                            </Button>
                            {error && (
                                <Typography
                                    level="body3"
                                    className="text-red-600"
                                >
                                    {error}
                                </Typography>
                            )}
                        </Stack>
                    );
                }

                if (field.type === 'textarea') {
                    return (
                        <label className="space-y-1" key={field.key}>
                            <span className="block text-sm font-medium">
                                {field.label}
                                {field.required && (
                                    <span className="text-red-600"> *</span>
                                )}
                            </span>
                            <textarea
                                value={textValue(section.data[field.key])}
                                rows={field.rows ?? 4}
                                placeholder={field.placeholder}
                                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                onChange={(event) =>
                                    updateField(field.key, event.target.value)
                                }
                            />
                            {field.helperText && (
                                <Typography level="body3" secondary>
                                    {field.helperText}
                                </Typography>
                            )}
                            {error && (
                                <Typography
                                    level="body3"
                                    className="text-red-600"
                                >
                                    {error}
                                </Typography>
                            )}
                        </label>
                    );
                }

                return (
                    <Stack spacing={2} key={field.key}>
                        <Input
                            fullWidth
                            label={`${field.label}${field.required ? ' *' : ''}`}
                            placeholder={field.placeholder}
                            type={field.type === 'url' ? 'url' : 'text'}
                            value={textValue(section.data[field.key])}
                            onChange={(event) =>
                                updateField(field.key, event.target.value)
                            }
                        />
                        {field.helperText && (
                            <Typography level="body3" secondary>
                                {field.helperText}
                            </Typography>
                        )}
                        {error && (
                            <Typography level="body3" className="text-red-600">
                                {error}
                            </Typography>
                        )}
                    </Stack>
                );
            })}
        </Stack>
    );
}
