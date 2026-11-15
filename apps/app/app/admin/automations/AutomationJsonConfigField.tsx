'use client';

import { Button } from '@gredice/ui/Button';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { type KeyboardEvent, useId } from 'react';
import { AutomationConfigFieldDescription } from './AutomationConfigFieldDescription';
import {
    type JsonConfigDraft,
    jsonFieldValue,
    resolveJsonDraft,
} from './automationConfigFieldValues';

/**
 * Edits JSON config through a draft owned by the editor (`draft`), so partially
 * typed JSON is never parsed on every keystroke and survives remounts. The
 * draft is applied on blur, the apply button or Ctrl/Cmd+Enter, and cleared
 * once applied or reverted.
 */
export function AutomationJsonConfigField({
    description,
    draft,
    label,
    onChange,
    onDraftChange,
    value,
}: {
    description: string | undefined;
    draft: JsonConfigDraft | undefined;
    label: string;
    onChange(value: unknown): void;
    onDraftChange(draft: JsonConfigDraft | undefined): void;
    value: unknown;
}) {
    const id = useId();
    const appliedText = jsonFieldValue(value);
    const text = draft?.text ?? appliedText;
    const error = draft?.error ?? null;
    const isDirty = text !== appliedText;
    const descriptionId = description ? `${id}-description` : undefined;
    const errorId = error ? `${id}-error` : undefined;

    function apply() {
        const resolution = resolveJsonDraft(text, appliedText);
        if (resolution.status === 'invalid') {
            onDraftChange(resolution.draft);
            return;
        }

        onDraftChange(undefined);
        if (resolution.status === 'applied') {
            onChange(resolution.value);
        }
    }

    function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            apply();
        }
    }

    return (
        <Stack spacing={1}>
            <label className="text-sm font-medium" htmlFor={id}>
                {label}
            </label>
            <textarea
                id={id}
                value={text}
                spellCheck={false}
                aria-invalid={error ? true : undefined}
                aria-describedby={
                    [descriptionId, errorId].filter(Boolean).join(' ') ||
                    undefined
                }
                onChange={(event) => {
                    const nextText = event.target.value;
                    onDraftChange(
                        nextText === appliedText
                            ? undefined
                            : { text: nextText, error: null },
                    );
                }}
                onBlur={apply}
                onKeyDown={handleKeyDown}
                className={cx(
                    'min-h-28 w-full rounded-md border bg-field px-3 py-2 font-mono text-xs outline-hidden ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    error
                        ? 'border-red-500 dark:border-red-400'
                        : 'border-input',
                )}
            />
            {error ? (
                <Typography
                    id={errorId}
                    role="alert"
                    level="body3"
                    className="text-red-700 dark:text-red-300"
                >
                    {error}
                </Typography>
            ) : null}
            <Row spacing={1} className="flex-wrap">
                <Button
                    type="button"
                    size="sm"
                    variant="soft"
                    disabled={!isDirty}
                    onClick={apply}
                >
                    Primijeni
                </Button>
                {error ? (
                    <Button
                        type="button"
                        size="sm"
                        variant="plain"
                        onClick={() => onDraftChange(undefined)}
                    >
                        Vrati spremljeno
                    </Button>
                ) : null}
                {isDirty && !error ? (
                    <Typography level="body3" className="text-muted-foreground">
                        Nije primijenjeno (Ctrl/Cmd + Enter)
                    </Typography>
                ) : null}
            </Row>
            <AutomationConfigFieldDescription id={descriptionId}>
                {description}
            </AutomationConfigFieldDescription>
        </Stack>
    );
}
