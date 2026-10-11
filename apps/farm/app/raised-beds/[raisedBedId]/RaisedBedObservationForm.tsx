'use client';

import {
    getObservationImagePathPrefix,
    MAX_OBSERVATION_IMAGE_COUNT,
    MAX_OBSERVATION_IMAGE_SIZE,
    MAX_OBSERVATION_NOTES_LENGTH,
    parseRaisedBedObservationTarget,
    type RaisedBedObservationTarget,
} from '@gredice/js/operations';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Modal } from '@gredice/ui/Modal';
import { upload } from '@vercel/blob/client';
import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';
import {
    recoverRaisedBedObservationImageAction,
    submitRaisedBedObservationAction,
} from './observationActions';

type Photo = { id: string; file: File; preview: string; url?: string };

export function RaisedBedObservationForm({
    raisedBedId,
    userId,
    plants,
    disabled = false,
}: {
    raisedBedId: number;
    userId: string;
    plants: { label: string; target: RaisedBedObservationTarget }[];
    disabled?: boolean;
}) {
    const id = useId();
    const [open, setOpen] = useState(false);
    const [targetValue, setTargetValue] = useState('bed');
    const targetUnavailable =
        targetValue !== 'bed' &&
        !plants.some((plant) => JSON.stringify(plant.target) === targetValue);
    const [notes, setNotes] = useState('');
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [pending, setPending] = useState(false);
    const [submissionUncertain, setSubmissionUncertain] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const submissionId = useRef<string | null>(null);
    const retrySubmission = useRef<FormData | null>(null);
    const editingLocked = pending || submissionUncertain;
    const busy = useRef(false);
    const photosRef = useRef(photos);
    photosRef.current = photos;
    useEffect(
        () => () => {
            for (const photo of photosRef.current)
                URL.revokeObjectURL(photo.preview);
        },
        [],
    );

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy.current) return;
        busy.current = true;
        setPending(true);
        setError(null);
        setSuccess(null);
        submissionId.current ??= crypto.randomUUID();
        try {
            let formData = retrySubmission.current;
            if (!formData) {
                const target = parseRaisedBedObservationTarget(
                    targetValue === 'bed'
                        ? { kind: 'bed', raisedBedId }
                        : JSON.parse(targetValue),
                );
                const imageUrls: string[] = [];
                for (const photo of photos) {
                    let url = photo.url;
                    if (!url) {
                        const extension =
                            photo.file.name
                                .split('.')
                                .pop()
                                ?.replace(/[^a-z0-9]/gi, '')
                                .slice(0, 10) || 'jpg';
                        const pathname = `${getObservationImagePathPrefix(raisedBedId, userId, submissionId.current)}${photo.id}.${extension}`;
                        try {
                            const blob = await upload(pathname, photo.file, {
                                access: 'public',
                                handleUploadUrl:
                                    '/api/raised-beds/observations/images/upload',
                                clientPayload: JSON.stringify({
                                    target,
                                    submissionId: submissionId.current,
                                }),
                            });
                            url = blob.url;
                        } catch (uploadError) {
                            url =
                                (await recoverRaisedBedObservationImageAction({
                                    target,
                                    submissionId: submissionId.current,
                                    pathname,
                                })) ?? undefined;
                            if (!url) throw uploadError;
                        }
                        setPhotos((current) =>
                            current.map((item) =>
                                item.id === photo.id ? { ...item, url } : item,
                            ),
                        );
                    }
                    imageUrls.push(url);
                }
                formData = new FormData();
                formData.set('target', JSON.stringify(target));
                formData.set('submissionId', submissionId.current);
                formData.set('notes', notes);
                formData.set('imageUrls', JSON.stringify(imageUrls));
            }
            retrySubmission.current = formData;
            const result = await submitRaisedBedObservationAction(formData);
            if (!result.success) {
                if (result.submissionUncertain || submissionUncertain) {
                    setSubmissionUncertain(true);
                    setError(
                        'Slanje nije potvrđeno. Pokušaj ponovno s istim opažanjem.',
                    );
                } else {
                    retrySubmission.current = null;
                    setError(result.message);
                }
                return;
            }
            for (const photo of photos) URL.revokeObjectURL(photo.preview);
            setPhotos([]);
            setNotes('');
            setTargetValue('bed');
            submissionId.current = null;
            retrySubmission.current = null;
            setSubmissionUncertain(false);
            setSuccess(result.message);
            setOpen(false);
        } catch {
            if (retrySubmission.current) {
                setSubmissionUncertain(true);
                setError(
                    'Slanje nije potvrđeno. Pokušaj ponovno s istim opažanjem.',
                );
            } else {
                setError(
                    'Opažanje nije poslano. Provjeri vezu i pokušaj ponovno.',
                );
            }
        } finally {
            busy.current = false;
            setPending(false);
        }
    }

    return (
        <div className="space-y-2">
            <Modal
                title="Opažanje gredice"
                open={open}
                onOpenChange={(next) => {
                    if (!busy.current) setOpen(next);
                }}
                trigger={
                    <Button
                        disabled={disabled && !submissionUncertain}
                        variant="outlined"
                    >
                        Zabilježi opažanje
                    </Button>
                }
            >
                <form onSubmit={submit} className="space-y-4">
                    <div className="space-y-1">
                        <label
                            htmlFor={`${id}-target`}
                            className="text-sm font-medium"
                        >
                            Opažanje za
                        </label>
                        <select
                            id={`${id}-target`}
                            value={targetValue}
                            onChange={(event) =>
                                setTargetValue(event.target.value)
                            }
                            disabled={editingLocked}
                            className="w-full rounded-md border border-input bg-field p-2 text-base"
                        >
                            <option value="bed">Cijela gredica</option>
                            {targetUnavailable && (
                                <option value={targetValue} disabled>
                                    {submissionUncertain
                                        ? 'Odabrana biljka više nije na popisu'
                                        : 'Biljka više nije dostupna — ponovno odaberi'}
                                </option>
                            )}
                            {plants.map((plant) => (
                                <option
                                    key={JSON.stringify(plant.target)}
                                    value={JSON.stringify(plant.target)}
                                >
                                    {plant.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label
                            htmlFor={`${id}-notes`}
                            className="text-sm font-medium"
                        >
                            Tekst opažanja
                        </label>
                        <textarea
                            id={`${id}-notes`}
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            disabled={editingLocked}
                            maxLength={MAX_OBSERVATION_NOTES_LENGTH}
                            rows={4}
                            className="w-full rounded-md border border-input bg-field p-2 text-base"
                        />
                    </div>
                    <div className="space-y-2">
                        <label
                            htmlFor={`${id}-photos`}
                            className="text-sm font-medium"
                        >
                            Fotografije (do 20, najviše 25 MB po fotografiji)
                        </label>
                        <input
                            id={`${id}-photos`}
                            type="file"
                            accept="image/*"
                            multiple
                            disabled={editingLocked}
                            className="block w-full text-sm"
                            onChange={(event) => {
                                const files = Array.from(
                                    event.target.files ?? [],
                                );
                                event.target.value = '';
                                if (
                                    photos.length + files.length >
                                    MAX_OBSERVATION_IMAGE_COUNT
                                ) {
                                    setError(
                                        'Možeš dodati najviše 20 fotografija.',
                                    );
                                    return;
                                }
                                if (
                                    files.some(
                                        (file) =>
                                            !file.type.startsWith('image/') ||
                                            file.size <= 0 ||
                                            file.size >
                                                MAX_OBSERVATION_IMAGE_SIZE,
                                    )
                                ) {
                                    setError(
                                        'Odaberi fotografije manje od 25 MB.',
                                    );
                                    return;
                                }
                                setError(null);
                                setPhotos((current) => [
                                    ...current,
                                    ...files.map((file) => ({
                                        id: crypto.randomUUID(),
                                        file,
                                        preview: URL.createObjectURL(file),
                                    })),
                                ]);
                            }}
                        />
                        {photos.map((photo, index) => (
                            <div
                                key={photo.id}
                                className="flex items-center gap-2"
                            >
                                <Image
                                    src={photo.preview}
                                    alt={`Odabrana fotografija ${index + 1}`}
                                    unoptimized
                                    width={64}
                                    height={64}
                                    className="size-16 rounded object-cover"
                                />
                                <span className="min-w-0 flex-1 break-all text-sm">
                                    {photo.file.name}
                                </span>
                                <Button
                                    type="button"
                                    variant="plain"
                                    disabled={editingLocked}
                                    aria-label={`Ukloni fotografiju ${index + 1}`}
                                    onClick={() => {
                                        URL.revokeObjectURL(photo.preview);
                                        setPhotos((current) =>
                                            current.filter(
                                                (item) => item.id !== photo.id,
                                            ),
                                        );
                                    }}
                                >
                                    Ukloni
                                </Button>
                            </div>
                        ))}
                    </div>
                    {error && (
                        <Alert color="danger" role="alert">
                            {error}
                        </Alert>
                    )}
                    <div className="flex flex-wrap justify-end gap-2">
                        <Button
                            type="button"
                            variant="outlined"
                            onClick={() => setOpen(false)}
                            disabled={pending}
                        >
                            Odustani
                        </Button>
                        <Button
                            type="submit"
                            loading={pending}
                            aria-busy={pending}
                            disabled={
                                pending ||
                                (!submissionUncertain &&
                                    (targetUnavailable || disabled)) ||
                                (!notes.trim() && photos.length === 0)
                            }
                        >
                            Pošalji na odobrenje
                        </Button>
                    </div>
                </form>
            </Modal>
            {success && (
                <p role="status" className="text-sm text-muted-foreground">
                    {success}
                </p>
            )}
        </div>
    );
}
