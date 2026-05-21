'use client';

import { useEffect, useState } from 'react';
import { IconButton } from '../IconButton';
import { Input } from '../Input';
import { Check, Close, Edit } from '../icons';
import { Row } from '../Row';
import { Typography } from '../Typography';
import { cx } from '../utils';

export type EditableInputProps = {
    value: string;
    onChange: (text: string) => void;
    className?: string;
};

export function EditableInput({
    className,
    onChange,
    value,
}: EditableInputProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);

    useEffect(() => {
        if (editing) {
            setDraft(value);
        }
    }, [editing, value]);

    function confirm() {
        onChange(draft);
        setEditing(false);
    }

    function cancel() {
        setDraft(value);
        setEditing(false);
    }

    if (editing) {
        return (
            <Row className={className} spacing={1}>
                <Input
                    autoFocus
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            confirm();
                        }

                        if (event.key === 'Escape') {
                            cancel();
                        }
                    }}
                    value={draft}
                />
                <Row spacing={1}>
                    <IconButton aria-label="Confirm edit" onClick={confirm}>
                        <Check className="size-4" />
                    </IconButton>
                    <IconButton aria-label="Cancel edit" onClick={cancel}>
                        <Close className="size-4" />
                    </IconButton>
                </Row>
            </Row>
        );
    }

    return (
        <button
            className={cx(
                'group flex cursor-pointer items-center gap-1 py-1 text-left',
                className,
            )}
            onClick={() => setEditing(true)}
            type="button"
        >
            <Typography component="span">{value}</Typography>
            <span className="invisible group-hover:visible">
                <Edit className="size-4" />
            </span>
        </button>
    );
}
