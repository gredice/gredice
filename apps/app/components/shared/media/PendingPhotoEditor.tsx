'use client';

import { Checkbox } from '@gredice/ui/Checkbox';
import {
    BUILT_IN_PRESETS,
    copyLook,
    type ImageAdjustments,
    InlinePhotoEditor,
    normalizeAdjustments,
    type PhotoEdit,
    renderEditedPhoto,
} from '@retusha/inline-editor';
import '@retusha/inline-editor/style.css';
import { useEffect, useRef, useState } from 'react';

export type PendingPhoto = {
    id: string;
    file: File;
    original?: File;
    adjustments?: ImageAdjustments;
};

const names: Record<string, string> = {
    'builtin:natural': 'Prirodno',
    'builtin:vibrant': 'Živopisno',
    'builtin:crisp': 'Istaknuti detalji',
    'builtin:warm': 'Toplo',
    'builtin:bw': 'Crno-bijelo',
};

const presets = BUILT_IN_PRESETS.filter((preset) => preset.id in names).map(
    (preset) => ({
        ...preset,
        name: names[preset.id],
    }),
);

export function PendingPhotoEditor({
    photo,
    pending,
    onApply,
    onCancel,
}: {
    photo: PendingPhoto;
    pending: PendingPhoto[];
    onApply: (edits: Map<string, PhotoEdit>) => void;
    onCancel: () => void;
}) {
    const [applyToAll, setApplyToAll] = useState(false);
    const mounted = useRef(false);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    async function save(edit: PhotoEdit) {
        const edits = new Map([[photo.id, edit]]);
        if (applyToAll) {
            // Render sequentially to bound GPU memory. Commit the queue only
            // after every render succeeds, so a failed batch is safe to retry.
            for (const item of pending) {
                if (!mounted.current) return;
                if (item.id === photo.id) continue;
                const adjustments = copyLook(
                    edit.adjustments,
                    normalizeAdjustments(item.adjustments),
                );
                edits.set(
                    item.id,
                    await renderEditedPhoto(
                        item.original ?? item.file,
                        adjustments,
                    ),
                );
            }
        }
        if (mounted.current) onApply(edits);
    }

    return (
        <>
            <InlinePhotoEditor
                file={photo.original ?? photo.file}
                initialAdjustments={photo.adjustments}
                locale="hr"
                presets={presets}
                onSave={save}
                onCancel={onCancel}
            />
            {pending.length > 1 && (
                <Checkbox
                    label={`Primijeni izgled na sve odabrane fotografije (${pending.length})`}
                    checked={applyToAll}
                    onCheckedChange={(checked) =>
                        setApplyToAll(checked === true)
                    }
                />
            )}
        </>
    );
}
