'use client';

import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Camera, Clear, Upload } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { PhotoEdit } from '@retusha/inline-editor';
import { upload } from '@vercel/blob/client';
import dynamic from 'next/dynamic';
import {
    type ChangeEvent,
    type ClipboardEvent,
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react';
import { ImageUploadPreview } from './ImageUploadPreview';
import type { PendingPhoto } from './PendingPhotoEditor';
import { runTasksWithConcurrency } from './runTasksWithConcurrency';

const PendingPhotoEditor = dynamic(
    () =>
        import('./PendingPhotoEditor').then(
            (module) => module.PendingPhotoEditor,
        ),
    { ssr: false, loading: () => <p role="status">Otvaranje uređivača…</p> },
);

type UploadItemStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

type UploadItem = PendingPhoto & {
    progress: number;
    status: UploadItemStatus;
    uploadedUrl?: string;
    errorMessage?: string;
    attempts: number;
};

type UploadPathInput = {
    attempt: number;
    file: File;
    itemId: string;
};

type ClientPayloadInput = UploadPathInput;

export type ImageUploadManagerState = {
    count: number;
    hasFailedUploads: boolean;
};

export type ImageUploadSelectionItem = {
    id: string;
    file: File;
};

export type ImageUploadManagerHandle = {
    hasFailedUploads: () => boolean;
    hasImages: () => boolean;
    reset: () => void;
    uploadPendingImages: () => Promise<string[] | null>;
};

type ImageUploadManagerProps = {
    addLabel?: string;
    addMoreLabel?: string;
    cameraLabel?: string;
    className?: string;
    clientPayload?:
        | string
        | ((input: ClientPayloadInput) => string | undefined);
    disabled?: boolean;
    editPhotos?: boolean;
    emptyLabel?: string;
    handleUploadUrl: string;
    itemLabel?: (item: ImageUploadSelectionItem) => string | undefined;
    layout?: 'grid' | 'list';
    maxItems?: number;
    maxFileBytes?: number;
    multiple?: boolean;
    onSelectionChange?: (items: ImageUploadSelectionItem[]) => void;
    onStateChange?: (state: ImageUploadManagerState) => void;
    pasteHint?: string;
    selectedLabel?: (count: number) => string;
    showCameraButton?: boolean;
    uploadConcurrency?: number;
    uploadPath: (input: UploadPathInput) => string;
};

const MAX_UPLOAD_ATTEMPTS = 3;
export const MULTIPART_UPLOAD_THRESHOLD_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSION_PATTERN = /\.(avif|gif|jpe?g|png|svg|webp)$/i;

function createUploadItem(file: File): UploadItem {
    return {
        id: crypto.randomUUID(),
        file,
        progress: 0,
        status: 'pending',
        attempts: 0,
    };
}

function clampUploadProgress(progress: number) {
    return Math.max(0, Math.min(100, Math.round(progress)));
}

function getUploadItemStatusLabel(uploadItem: UploadItem) {
    switch (uploadItem.status) {
        case 'uploaded':
            return 'Učitano';
        case 'uploading':
            return uploadItem.attempts > 1
                ? `Učitavanje, pokušaj ${uploadItem.attempts}/${MAX_UPLOAD_ATTEMPTS}`
                : 'Učitavanje';
        case 'failed':
            return uploadItem.errorMessage
                ? `Neuspjelo: ${uploadItem.errorMessage}`
                : `Neuspjelo nakon ${uploadItem.attempts}/${MAX_UPLOAD_ATTEMPTS} pokušaja`;
        default:
            return 'Čeka učitavanje';
    }
}

function getUploadItemStatusClassName(uploadItem: UploadItem) {
    switch (uploadItem.status) {
        case 'uploaded':
            return 'text-green-600';
        case 'failed':
            return 'text-red-600';
        default:
            return 'text-muted-foreground';
    }
}

function getUploadItemProgressClassName(uploadItem: UploadItem) {
    switch (uploadItem.status) {
        case 'uploaded':
            return 'bg-green-600';
        case 'failed':
            return 'bg-red-600';
        case 'uploading':
            return 'bg-primary';
        default:
            return 'bg-muted-foreground/40';
    }
}

function selectedImagesLabel(count: number) {
    return `Odabrano ${count} ${count === 1 ? 'slika' : 'slike'}`;
}

function isImageFile(file: File) {
    return (
        file.type.startsWith('image/') ||
        IMAGE_EXTENSION_PATTERN.test(file.name)
    );
}

function getClipboardImageFiles(clipboardData: DataTransfer) {
    const files = Array.from(clipboardData.files).filter(isImageFile);
    if (files.length > 0) {
        return files;
    }

    return Array.from(clipboardData.items)
        .filter(
            (item) => item.kind === 'file' && item.type.startsWith('image/'),
        )
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file));
}

function resetInput(input: HTMLInputElement | null) {
    if (input) {
        input.value = '';
    }
}

export const ImageUploadManager = forwardRef<
    ImageUploadManagerHandle,
    ImageUploadManagerProps
>(function ImageUploadManager(
    {
        addLabel = 'Dodaj slike',
        addMoreLabel = 'Dodaj još slika',
        cameraLabel = 'Uslikaj fotografiju',
        className,
        clientPayload,
        disabled,
        editPhotos = false,
        emptyLabel = 'Odaberite slike ili ih zalijepite iz međuspremnika.',
        handleUploadUrl,
        itemLabel,
        layout = 'list',
        maxItems,
        maxFileBytes,
        multiple = true,
        onSelectionChange,
        onStateChange,
        pasteHint = 'Kliknite ovdje i zalijepite sliku iz međuspremnika.',
        selectedLabel = selectedImagesLabel,
        showCameraButton = true,
        uploadConcurrency = 1,
        uploadPath,
    },
    ref,
) {
    const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const pending = uploadItems.filter(
        (item) => item.status === 'pending' || item.status === 'failed',
    );
    const editingPhoto = editingId
        ? pending.find((item) => item.id === editingId)
        : undefined;

    function applyPhotoEdits(edits: Map<string, PhotoEdit>) {
        setUploadItems((current) =>
            current.map((item) => {
                const edit = edits.get(item.id);
                if (
                    !edit ||
                    (item.status !== 'pending' && item.status !== 'failed')
                )
                    return item;
                return {
                    ...item,
                    ...edit,
                    original: item.original ?? item.file,
                    progress: 0,
                    status: 'pending',
                    attempts: 0,
                    errorMessage: undefined,
                    uploadedUrl: undefined,
                };
            }),
        );
        setErrorMessage(null);
        setEditingId(null);
    }

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const hasFailedUploads = uploadItems.some(
        (uploadItem) => uploadItem.status === 'failed',
    );
    const selectedItems = uploadItems.map((uploadItem) => ({
        id: uploadItem.id,
        file: uploadItem.original ?? uploadItem.file,
    }));
    const selectionKey = selectedItems.map((item) => item.id).join(':');
    const selectionSnapshotRef = useRef({ selectionKey, selectedItems });
    selectionSnapshotRef.current = { selectionKey, selectedItems };

    useEffect(() => {
        onStateChange?.({
            count: uploadItems.length,
            hasFailedUploads,
        });
    }, [hasFailedUploads, onStateChange, uploadItems.length]);

    useEffect(() => {
        if (selectionSnapshotRef.current.selectionKey === selectionKey) {
            onSelectionChange?.(selectionSnapshotRef.current.selectedItems);
        }
    }, [onSelectionChange, selectionKey]);

    const updateUploadItem = useCallback(
        (
            uploadItemId: string,
            updater: (uploadItem: UploadItem) => UploadItem,
        ) => {
            setUploadItems((currentUploadItems) =>
                currentUploadItems.map((uploadItem) =>
                    uploadItem.id === uploadItemId
                        ? updater(uploadItem)
                        : uploadItem,
                ),
            );
        },
        [],
    );

    const addFiles = (files: File[]) => {
        const imageFiles = files.filter(isImageFile);
        if (imageFiles.length === 0) return;

        const nextUploadItems = imageFiles.map(createUploadItem);
        setUploadItems((currentUploadItems) => {
            const combinedUploadItems = multiple
                ? [...currentUploadItems, ...nextUploadItems]
                : nextUploadItems;

            return typeof maxItems === 'number'
                ? combinedUploadItems.slice(0, Math.max(0, maxItems))
                : combinedUploadItems;
        });
        setErrorMessage(null);
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            addFiles(Array.from(event.target.files));
        }

        resetInput(fileInputRef.current);
        resetInput(cameraInputRef.current);
    };

    const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
        if (disabled || editingId) return;
        const pastedImageFiles = getClipboardImageFiles(event.clipboardData);
        if (pastedImageFiles.length === 0) return;

        event.preventDefault();
        addFiles(pastedImageFiles);
    };

    const resetUploadItem = (uploadItemId: string) => {
        setErrorMessage(null);
        updateUploadItem(uploadItemId, (uploadItem) => ({
            ...uploadItem,
            progress: 0,
            status: 'pending',
            errorMessage: undefined,
            attempts: 0,
        }));
    };

    const removeUploadItem = (uploadItemId: string) => {
        setErrorMessage(null);
        setUploadItems((currentUploadItems) =>
            currentUploadItems.filter(
                (uploadItem) => uploadItem.id !== uploadItemId,
            ),
        );
    };

    const uploadImage = useCallback(
        async (uploadItem: UploadItem) => {
            if (
                maxFileBytes !== undefined &&
                uploadItem.file.size > maxFileBytes
            ) {
                updateUploadItem(uploadItem.id, (item) => ({
                    ...item,
                    status: 'failed',
                    progress: 0,
                    attempts: 0,
                    uploadedUrl: undefined,
                    errorMessage: `Slika premašuje ograničenje od ${maxFileBytes / (1024 * 1024)} MiB.`,
                }));
                return null;
            }
            let lastErrorMessage = 'Spremanje slike nije uspjelo.';

            for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt++) {
                const uploadInput = {
                    attempt,
                    file: uploadItem.file,
                    itemId: uploadItem.id,
                } satisfies UploadPathInput;

                updateUploadItem(uploadItem.id, (currentUploadItem) => ({
                    ...currentUploadItem,
                    progress: 0,
                    status: 'uploading',
                    errorMessage: undefined,
                    attempts: attempt,
                }));

                try {
                    const uploadedImage = await upload(
                        uploadPath(uploadInput),
                        uploadItem.file,
                        {
                            access: 'public',
                            contentType: uploadItem.file.type || undefined,
                            handleUploadUrl,
                            clientPayload:
                                typeof clientPayload === 'function'
                                    ? clientPayload(uploadInput)
                                    : clientPayload,
                            multipart:
                                uploadItem.file.size >
                                MULTIPART_UPLOAD_THRESHOLD_BYTES,
                            onUploadProgress: ({ percentage }) => {
                                updateUploadItem(
                                    uploadItem.id,
                                    (currentUploadItem) => ({
                                        ...currentUploadItem,
                                        progress:
                                            clampUploadProgress(percentage),
                                        status: 'uploading',
                                        attempts: attempt,
                                    }),
                                );
                            },
                        },
                    );

                    updateUploadItem(uploadItem.id, (currentUploadItem) => ({
                        ...currentUploadItem,
                        progress: 100,
                        status: 'uploaded',
                        uploadedUrl: uploadedImage.url,
                        errorMessage: undefined,
                        attempts: attempt,
                    }));

                    return uploadedImage.url;
                } catch (error) {
                    console.error(
                        'Error uploading image:',
                        uploadItem.file.name,
                        error,
                    );
                    lastErrorMessage =
                        error instanceof Error && error.message
                            ? error.message
                            : 'Spremanje slike nije uspjelo.';
                }
            }

            updateUploadItem(uploadItem.id, (currentUploadItem) => ({
                ...currentUploadItem,
                progress: 0,
                status: 'failed',
                uploadedUrl: undefined,
                errorMessage: lastErrorMessage,
                attempts: MAX_UPLOAD_ATTEMPTS,
            }));

            return null;
        },
        [
            clientPayload,
            handleUploadUrl,
            maxFileBytes,
            updateUploadItem,
            uploadPath,
        ],
    );

    const reset = useCallback(() => {
        setUploadItems([]);
        setEditingId(null);
        setErrorMessage(null);
        resetInput(fileInputRef.current);
        resetInput(cameraInputRef.current);
    }, []);

    useImperativeHandle(
        ref,
        () => ({
            hasFailedUploads: () =>
                uploadItems.some(
                    (uploadItem) => uploadItem.status === 'failed',
                ),
            hasImages: () => uploadItems.length > 0,
            reset,
            uploadPendingImages: async () => {
                if (editingId) return null;
                setErrorMessage(null);
                const imageUrls = await runTasksWithConcurrency(
                    uploadItems,
                    uploadConcurrency,
                    async (uploadItem) => {
                        if (
                            uploadItem.status === 'uploaded' &&
                            uploadItem.uploadedUrl
                        ) {
                            return uploadItem.uploadedUrl;
                        }

                        return uploadImage(uploadItem);
                    },
                );

                if (imageUrls.some((imageUrl) => imageUrl === null)) {
                    setErrorMessage(
                        'Neke slike nisu učitane. Neuspjele stavke možete pokušati ponovno bez ponovnog odabira.',
                    );
                    return null;
                }

                return imageUrls.filter(
                    (imageUrl): imageUrl is string => imageUrl !== null,
                );
            },
        }),
        [editingId, reset, uploadConcurrency, uploadImage, uploadItems],
    );

    return (
        <Stack
            spacing={2}
            className={cx(
                'rounded-md border border-dashed border-input bg-muted/20 p-3 outline-hidden focus-within:border-primary focus-within:ring-2 focus-within:ring-ring',
                className,
            )}
            onPaste={handlePaste}
            tabIndex={disabled ? -1 : 0}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple={multiple}
                className="hidden"
                onChange={handleFileChange}
            />
            {showCameraButton && (
                <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                />
            )}
            <Row spacing={2} className="flex-wrap">
                {showCameraButton && (
                    <Button
                        variant="outlined"
                        type="button"
                        size="sm"
                        startDecorator={<Camera className="size-4" />}
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={disabled}
                    >
                        {cameraLabel}
                    </Button>
                )}
                <Button
                    variant="outlined"
                    type="button"
                    size="sm"
                    startDecorator={<Upload className="size-4" />}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled}
                >
                    {uploadItems.length > 0 ? addMoreLabel : addLabel}
                </Button>
            </Row>
            <Typography level="body2" className="text-muted-foreground">
                {uploadItems.length > 0
                    ? selectedLabel(uploadItems.length)
                    : emptyLabel}
            </Typography>
            <Typography level="body3" className="text-muted-foreground">
                {pasteHint}
            </Typography>
            {uploadItems.length > 0 && (
                <div
                    data-image-upload-layout={layout}
                    className={cx(
                        layout === 'grid'
                            ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4'
                            : 'flex flex-col gap-2',
                    )}
                >
                    {uploadItems.map((uploadItem) => {
                        const progress =
                            uploadItem.status === 'uploaded'
                                ? 100
                                : clampUploadProgress(uploadItem.progress);
                        const label = itemLabel?.({
                            id: uploadItem.id,
                            file: uploadItem.original ?? uploadItem.file,
                        });

                        return (
                            <div
                                key={uploadItem.id}
                                className={cx(
                                    'rounded-md border bg-background',
                                    layout === 'grid'
                                        ? 'relative overflow-hidden'
                                        : 'px-3 py-2',
                                )}
                            >
                                {layout === 'grid' && (
                                    <>
                                        <ImageUploadPreview
                                            file={uploadItem.file}
                                        />
                                        {label && (
                                            <Typography
                                                level="body3"
                                                className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 font-medium shadow-sm backdrop-blur-sm"
                                            >
                                                {label}
                                            </Typography>
                                        )}
                                    </>
                                )}
                                <div className={cx(layout === 'grid' && 'p-2')}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <Typography
                                                level="body2"
                                                className="truncate"
                                                title={uploadItem.file.name}
                                            >
                                                {uploadItem.file.name}
                                            </Typography>
                                            <Typography
                                                level="body2"
                                                className={`text-xs ${getUploadItemStatusClassName(uploadItem)}`}
                                            >
                                                {getUploadItemStatusLabel(
                                                    uploadItem,
                                                )}
                                            </Typography>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            {layout === 'list' && (
                                                <Typography
                                                    level="body2"
                                                    className="text-xs text-muted-foreground"
                                                >
                                                    {progress}%
                                                </Typography>
                                            )}
                                            <IconButton
                                                aria-label={`Ukloni sliku ${uploadItem.file.name}`}
                                                type="button"
                                                size="xs"
                                                variant={
                                                    layout === 'grid'
                                                        ? 'solid'
                                                        : 'plain'
                                                }
                                                color={
                                                    layout === 'grid'
                                                        ? 'danger'
                                                        : undefined
                                                }
                                                className={cx(
                                                    layout === 'grid' &&
                                                        'absolute right-2 top-2',
                                                )}
                                                disabled={disabled}
                                                onClick={() =>
                                                    removeUploadItem(
                                                        uploadItem.id,
                                                    )
                                                }
                                            >
                                                <Clear className="size-3.5" />
                                            </IconButton>
                                        </div>
                                    </div>
                                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className={`h-full transition-[width] duration-200 ${getUploadItemProgressClassName(uploadItem)}`}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    {editPhotos &&
                                        (uploadItem.status === 'pending' ||
                                            uploadItem.status === 'failed') && (
                                            <Button
                                                type="button"
                                                variant="outlined"
                                                size="sm"
                                                className="mt-2"
                                                aria-label={`Uredi sliku ${uploadItem.file.name}`}
                                                disabled={disabled}
                                                onClick={() =>
                                                    setEditingId(uploadItem.id)
                                                }
                                            >
                                                Uredi sliku
                                            </Button>
                                        )}
                                    {uploadItem.status === 'failed' &&
                                        !disabled && (
                                            <div className="mt-2">
                                                <Button
                                                    variant="outlined"
                                                    type="button"
                                                    size="sm"
                                                    onClick={() =>
                                                        resetUploadItem(
                                                            uploadItem.id,
                                                        )
                                                    }
                                                >
                                                    Pokušaj ponovno
                                                </Button>
                                            </div>
                                        )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {editingPhoto && (
                <Modal
                    open
                    title={`Uredi sliku ${editingPhoto.file.name}`}
                    className="max-w-2xl"
                    onOpenChange={(open) => {
                        if (!open) setEditingId(null);
                    }}
                >
                    <PendingPhotoEditor
                        key={editingPhoto.id}
                        photo={editingPhoto}
                        maxFileBytes={maxFileBytes}
                        pending={pending}
                        onApply={applyPhotoEdits}
                        onCancel={() => setEditingId(null)}
                    />
                </Modal>
            )}
            {errorMessage && (
                <Typography level="body2" className="text-red-600">
                    {errorMessage}
                </Typography>
            )}
        </Stack>
    );
});
