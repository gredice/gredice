'use client';

import { Chip } from '@gredice/ui/Chip';
import { Close } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useId, useRef, useState } from 'react';

type CmsPageTagsInputProps = {
    label: string;
    name: string;
    value: string[];
    helperText?: string;
    placeholder?: string;
    onChange: (value: string[]) => void;
};

function normalizeTag(value: string) {
    return value.trim().replace(/\s+/g, ' ');
}

function mergeTags(currentTags: string[], nextTags: string[]) {
    const seen = new Set(
        currentTags.map((tag) => tag.toLocaleLowerCase('hr-HR')),
    );
    const merged = [...currentTags];

    for (const rawTag of nextTags) {
        const tag = normalizeTag(rawTag);
        if (!tag) {
            continue;
        }

        const key = tag.toLocaleLowerCase('hr-HR');
        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        merged.push(tag);
    }

    return merged;
}

function splitTagInput(value: string) {
    return value.split(',').map(normalizeTag).filter(Boolean);
}

export function CmsPageTagsInput({
    helperText,
    label,
    name,
    onChange,
    placeholder,
    value,
}: CmsPageTagsInputProps) {
    const inputId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [draftValue, setDraftValue] = useState('');

    const commitTags = (rawValue = draftValue) => {
        const nextTags = splitTagInput(rawValue);
        if (nextTags.length === 0) {
            setDraftValue('');
            return;
        }

        const merged = mergeTags(value, nextTags);
        if (merged.length !== value.length) {
            onChange(merged);
        }
        setDraftValue('');
    };

    const removeTag = (tagToRemove: string) => {
        onChange(value.filter((tag) => tag !== tagToRemove));
        inputRef.current?.focus();
    };

    return (
        <div className="space-y-1">
            <label
                className="block text-sm font-medium text-foreground"
                htmlFor={inputId}
            >
                {label}
            </label>
            <input
                name={name}
                type="hidden"
                value={value.join(', ')}
                readOnly
            />
            <div
                className={cx(
                    'flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 ring-offset-background transition-colors',
                    'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                )}
            >
                {value.map((tag) => (
                    <Chip
                        key={tag}
                        size="sm"
                        variant="soft"
                        className="max-w-full gap-1 pr-1"
                    >
                        <span className="min-w-0 truncate">{tag}</span>
                        <button
                            type="button"
                            className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`Ukloni tag ${tag}`}
                            title={`Ukloni tag ${tag}`}
                            onClick={(event) => {
                                event.stopPropagation();
                                removeTag(tag);
                            }}
                        >
                            <Close className="size-3" />
                        </button>
                    </Chip>
                ))}
                <input
                    ref={inputRef}
                    id={inputId}
                    className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm outline-hidden placeholder:text-current placeholder:opacity-50"
                    placeholder={value.length === 0 ? placeholder : undefined}
                    value={draftValue}
                    onBlur={() => commitTags()}
                    onChange={(event) => {
                        const nextValue = event.target.value;
                        if (!nextValue.includes(',')) {
                            setDraftValue(nextValue);
                            return;
                        }

                        const parts = nextValue.split(',');
                        const committedParts = parts.slice(0, -1);
                        const nextDraftValue = parts.at(-1) ?? '';
                        const merged = mergeTags(value, committedParts);
                        if (merged.length !== value.length) {
                            onChange(merged);
                        }
                        setDraftValue(nextDraftValue);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Tab' && draftValue.trim()) {
                            commitTags();
                            return;
                        }

                        if (event.key === ',' || event.key === 'Enter') {
                            event.preventDefault();
                            commitTags();
                            return;
                        }

                        if (
                            event.key !== 'Backspace' ||
                            draftValue.length > 0
                        ) {
                            return;
                        }

                        const previousTag = value.at(-1);
                        if (!previousTag) {
                            return;
                        }

                        event.preventDefault();
                        onChange(value.slice(0, -1));
                        setDraftValue(previousTag);
                    }}
                />
            </div>
            {helperText ? (
                <Typography level="body3" secondary>
                    {helperText}
                </Typography>
            ) : null}
        </div>
    );
}
