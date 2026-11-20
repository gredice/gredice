'use client';

import { Button } from '@gredice/ui/Button';
import { Stack } from '@gredice/ui/Stack';
import type { PhotoEdit } from '@retusha/inline-editor';
import { useEffect, useState } from 'react';
import { PendingPhotoEditor } from '../../../components/shared/media/PendingPhotoEditor';
import {
    isGrediceWebsiteImage,
    MAX_OPERATION_IMAGE_SIZE_BYTES,
} from '../../../lib/operationPhotoUpload';

export type SubmittedPhotoEdit = PhotoEdit & { original: File };

export function SubmittedPhotoEditor({
    operationId,
    src,
    edit,
    onApply,
    onCancel,
}: {
    operationId: number;
    src: string;
    edit?: SubmittedPhotoEdit;
    onApply: (edit: SubmittedPhotoEdit) => void;
    onCancel: () => void;
}) {
    const [original, setOriginal] = useState(edit?.original);
    const [failedAttempt, setFailedAttempt] = useState<number>();
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (original) return;
        const controller = new AbortController();
        async function load() {
            const url = isGrediceWebsiteImage(src)
                ? '/api/operations/images/source?' +
                  new URLSearchParams({ operationId: String(operationId), src })
                : src;
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error('Photo unavailable');
            const blob = await response.blob();
            const name =
                new URL(src, window.location.href).pathname.split('/').pop() ||
                'fotografija';
            if (!controller.signal.aborted)
                setOriginal(new File([blob], name, { type: blob.type }));
        }
        void load().catch(() => {
            if (!controller.signal.aborted) setFailedAttempt(attempt);
        });
        return () => controller.abort();
    }, [operationId, src, original, attempt]);

    if (!original) {
        const failed = failedAttempt === attempt;
        return (
            <Stack spacing={2}>
                <p role="status">
                    {failed
                        ? 'Učitavanje izvorne fotografije nije uspjelo.'
                        : 'Učitavanje izvorne fotografije…'}
                </p>
                {failed && (
                    <Button
                        variant="outlined"
                        onClick={() => setAttempt(attempt + 1)}
                    >
                        Pokušaj ponovno
                    </Button>
                )}
                <Button variant="plain" onClick={onCancel}>
                    Odustani
                </Button>
            </Stack>
        );
    }
    const photo = {
        id: src,
        original,
        file: edit?.file ?? original,
        adjustments: edit?.adjustments,
    };
    return (
        <PendingPhotoEditor
            photo={photo}
            pending={[photo]}
            maxFileBytes={MAX_OPERATION_IMAGE_SIZE_BYTES}
            onCancel={onCancel}
            onApply={(edits) => {
                const result = edits.get(src);
                if (result) onApply({ ...result, original });
            }}
        />
    );
}
