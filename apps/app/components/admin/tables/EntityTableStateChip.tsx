'use client';

import type { SelectEntity } from '@gredice/storage';
import { Check, Megaphone } from '@signalco/ui-icons';
import { Chip } from '@signalco/ui-primitives/Chip';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@signalco/ui-primitives/Menu';
import { useId, useState } from 'react';

export function EntityTableStateChip({
    initialState,
    onPublish,
    completeness,
}: {
    initialState: SelectEntity['state'];
    onPublish: () => Promise<void>;
    completeness: { progress: number; isComplete: boolean };
}) {
    const [state, setState] = useState(initialState);
    const [loading, setLoading] = useState(false);
    const progressRingId = useId();

    const handlePublish = async () => {
        setLoading(true);

        try {
            await onPublish();
            setState('published');
        } finally {
            setLoading(false);
        }
    };

    if (state !== 'draft') {
        if (completeness.isComplete) {
            return null;
        }

        return (
            <span
                className="inline-flex items-center"
                title={`Nedostaju obavezni atributi (${Math.round(completeness.progress)}%)`}
            >
                <DraftCompletenessIndicator
                    completeness={completeness}
                    progressRingId={progressRingId}
                />
            </span>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="inline-flex appearance-none rounded-2xl border-0 bg-transparent p-0"
                    aria-label="Promijeni status zapisa"
                    disabled={loading}
                >
                    <Chip
                        color="neutral"
                        className="w-fit"
                        title="Promijeni status zapisa"
                    >
                        <span className="inline-flex items-center gap-1">
                            <DraftCompletenessIndicator
                                completeness={completeness}
                                progressRingId={progressRingId}
                            />
                            Draft
                        </span>
                    </Chip>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                <DropdownMenuItem
                    onClick={handlePublish}
                    disabled={loading}
                    startDecorator={<Megaphone className="size-5 shrink-0" />}
                >
                    Objavi
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function DraftCompletenessIndicator({
    completeness,
    progressRingId,
}: {
    completeness: { progress: number; isComplete: boolean };
    progressRingId: string;
}) {
    if (completeness.isComplete) {
        return (
            <span className="relative inline-flex size-4 items-center justify-center rounded-full border border-green-500 text-green-500">
                <Check className="size-3" aria-hidden />
                <span className="sr-only">
                    Svi obavezni atributi su ispunjeni
                </span>
            </span>
        );
    }

    const progress = Math.max(0, Math.min(100, completeness.progress));
    const radius = 6;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference - (progress / 100) * circumference;

    return (
        <span className="relative inline-flex size-4 items-center justify-center">
            <svg
                className="size-4 -rotate-90"
                viewBox="0 0 16 16"
                role="img"
                aria-labelledby={progressRingId}
            >
                <title
                    id={progressRingId}
                >{`Ispunjeno ${progress.toFixed(0)}% obaveznih atributa`}</title>
                <circle
                    cx="8"
                    cy="8"
                    r={radius}
                    className="fill-none stroke-primary/20"
                    strokeWidth="2"
                />
                <circle
                    cx="8"
                    cy="8"
                    r={radius}
                    className="fill-none stroke-primary"
                    strokeWidth="2"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                />
            </svg>
        </span>
    );
}
