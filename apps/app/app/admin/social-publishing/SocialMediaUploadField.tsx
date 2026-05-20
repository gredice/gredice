'use client';

import { Clear, Upload } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { upload } from '@vercel/blob/client';
import { type ChangeEvent, useId, useRef, useState } from 'react';

type UploadItemStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

type UploadItem = {
    id: string;
    file: File;
    progress: number;
    status: UploadItemStatus;
    uploadedUrl?: string;
    errorMessage?: string;
    attempts: number;
};

type SocialMediaUploadFieldProps = {
    name?: string;
    provider: string;
    providerAccountKey: string;
};

const MAX_UPLOAD_ATTEMPTS = 3;
const MAX_SOCIAL_MEDIA_SIZE_BYTES = 100 * 1024 * 1024;
const MULTIPART_UPLOAD_THRESHOLD_BYTES = 8 * 1024 * 1024;
const SUPPORTED_MEDIA_EXTENSION_PATTERN =
    /\.(avif|gif|jpe?g|m4v|mov|mp4|png|webm|webp)$/i;

function createUploadItem(file: File): UploadItem {
    return {
        id: crypto.randomUUID(),
        file,
        progress: 0,
        status: 'pending',
        attempts: 0,
    };
}

function isSupportedMediaFile(file: File) {
    return (
        file.type.startsWith('image/') ||
        file.type.startsWith('video/') ||
        SUPPORTED_MEDIA_EXTENSION_PATTERN.test(file.name)
    );
}

function toPathSegment(value: string) {
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);

    return normalized || 'default';
}

function getFileExtension(fileName: string) {
    const match = fileName.toLowerCase().match(/\.[a-z0-9]{1,8}$/);
    return match?.[0] ?? '';
}

function getFileBaseName(fileName: string) {
    const extension = getFileExtension(fileName);
    const baseName = extension
        ? fileName.slice(0, Math.max(0, fileName.length - extension.length))
        : fileName;

    return toPathSegment(baseName).slice(0, 48) || 'media';
}

function getUploadPathname(
    uploadItem: UploadItem,
    provider: string,
    providerAccountKey: string,
    attempt: number,
) {
    const extension = getFileExtension(uploadItem.file.name);
    const fileName = `${Date.now()}-${uploadItem.id}-${attempt}-${getFileBaseName(uploadItem.file.name)}${extension}`;

    return `social/${toPathSegment(provider)}/${toPathSegment(providerAccountKey)}/${fileName}`;
}

function clampUploadProgress(progress: number) {
    return Math.max(0, Math.min(100, Math.round(progress)));
}

function parseMediaUrlLines(value: string) {
    return value
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function appendMediaUrl(value: string, url: string) {
    const urls = parseMediaUrlLines(value);
    if (!urls.includes(url)) urls.push(url);
    return urls.join('\n');
}

function removeMediaUrl(value: string, url: string) {
    return parseMediaUrlLines(value)
        .filter((entry) => entry !== url)
        .join('\n');
}

function formatFileSize(sizeBytes: number) {
    const megabytes = sizeBytes / 1024 / 1024;
    return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
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
                : 'Neuspjelo';
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

export function SocialMediaUploadField({
    name = 'mediaUrls',
    provider,
    providerAccountKey,
}: SocialMediaUploadFieldProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaId = useId();
    const [mediaUrlsText, setMediaUrlsText] = useState('');
    const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const mediaUrlCount = parseMediaUrlLines(mediaUrlsText).length;

    function updateUploadItem(
        uploadItemId: string,
        updater: (uploadItem: UploadItem) => UploadItem,
    ) {
        setUploadItems((currentUploadItems) =>
            currentUploadItems.map((uploadItem) =>
                uploadItem.id === uploadItemId
                    ? updater(uploadItem)
                    : uploadItem,
            ),
        );
    }

    async function uploadMediaItem(uploadItem: UploadItem) {
        const uploadProvider = provider;
        const uploadProviderAccountKey = providerAccountKey || 'default';
        let lastErrorMessage = 'Spremanje medija nije uspjelo.';

        for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt++) {
            updateUploadItem(uploadItem.id, (currentUploadItem) => ({
                ...currentUploadItem,
                progress: 0,
                status: 'uploading',
                errorMessage: undefined,
                attempts: attempt,
            }));

            try {
                const uploadedMedia = await upload(
                    getUploadPathname(
                        uploadItem,
                        uploadProvider,
                        uploadProviderAccountKey,
                        attempt,
                    ),
                    uploadItem.file,
                    {
                        access: 'public',
                        contentType: uploadItem.file.type || undefined,
                        handleUploadUrl: '/api/social-publishing/media/upload',
                        clientPayload: JSON.stringify({
                            provider: uploadProvider,
                            providerAccountKey: uploadProviderAccountKey,
                        }),
                        multipart:
                            uploadItem.file.size >
                            MULTIPART_UPLOAD_THRESHOLD_BYTES,
                        onUploadProgress: ({ percentage }) => {
                            updateUploadItem(
                                uploadItem.id,
                                (currentUploadItem) => ({
                                    ...currentUploadItem,
                                    progress: clampUploadProgress(percentage),
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
                    uploadedUrl: uploadedMedia.url,
                    errorMessage: undefined,
                    attempts: attempt,
                }));
                setMediaUrlsText((currentValue) =>
                    appendMediaUrl(currentValue, uploadedMedia.url),
                );

                return uploadedMedia.url;
            } catch (error) {
                console.error(
                    'Error uploading social media:',
                    uploadItem.file.name,
                    error,
                );
                lastErrorMessage =
                    error instanceof Error && error.message
                        ? error.message
                        : 'Spremanje medija nije uspjelo.';
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
    }

    async function uploadMediaItems(nextUploadItems: UploadItem[]) {
        if (nextUploadItems.length === 0) return;

        setIsUploading(true);
        try {
            for (const uploadItem of nextUploadItems) {
                await uploadMediaItem(uploadItem);
            }
        } finally {
            setIsUploading(false);
        }
    }

    function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const files = Array.from(event.target.files ?? []);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (files.length === 0) return;

        const rejectedFiles = files.filter(
            (file) =>
                !isSupportedMediaFile(file) ||
                file.size > MAX_SOCIAL_MEDIA_SIZE_BYTES,
        );
        const acceptedFiles = files.filter(
            (file) =>
                isSupportedMediaFile(file) &&
                file.size <= MAX_SOCIAL_MEDIA_SIZE_BYTES,
        );
        if (rejectedFiles.length > 0) {
            setErrorMessage(
                `Neki mediji nisu dodani. Podržane su slike i video do ${formatFileSize(MAX_SOCIAL_MEDIA_SIZE_BYTES)}.`,
            );
        } else {
            setErrorMessage(null);
        }

        const nextUploadItems = acceptedFiles.map(createUploadItem);
        setUploadItems((currentUploadItems) => [
            ...currentUploadItems,
            ...nextUploadItems,
        ]);
        void uploadMediaItems(nextUploadItems);
    }

    function removeUploadItem(uploadItemId: string) {
        const uploadItem = uploadItems.find(
            (currentUploadItem) => currentUploadItem.id === uploadItemId,
        );
        setUploadItems((currentUploadItems) =>
            currentUploadItems.filter(
                (currentUploadItem) => currentUploadItem.id !== uploadItemId,
            ),
        );
        if (uploadItem?.uploadedUrl) {
            setMediaUrlsText((currentValue) =>
                removeMediaUrl(currentValue, uploadItem.uploadedUrl ?? ''),
            );
        }
    }

    function retryUploadItem(uploadItem: UploadItem) {
        setErrorMessage(null);
        updateUploadItem(uploadItem.id, (currentUploadItem) => ({
            ...currentUploadItem,
            progress: 0,
            status: 'pending',
            errorMessage: undefined,
            uploadedUrl: undefined,
            attempts: 0,
        }));
        void uploadMediaItems([uploadItem]);
    }

    return (
        <div className="flex flex-col gap-1 text-sm">
            <label htmlFor={textareaId} className="font-medium">
                Mediji
            </label>
            <div className="space-y-3 rounded border border-muted bg-card p-2">
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <Button
                        type="button"
                        variant="outlined"
                        startDecorator={<Upload className="size-4" />}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                    >
                        {isUploading ? 'Učitavanje...' : 'Dodaj slike/video'}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                        {mediaUrlCount > 0
                            ? `Dodano URL-ova: ${mediaUrlCount}`
                            : 'Bez medija'}
                    </span>
                </div>
                <textarea
                    id={textareaId}
                    name={name}
                    rows={5}
                    placeholder="https://.../slika.jpg&#10;https://.../video.mp4"
                    className="w-full rounded border border-muted bg-card p-2"
                    value={mediaUrlsText}
                    onChange={(event) => {
                        setMediaUrlsText(event.target.value);
                        setErrorMessage(null);
                    }}
                />
                {uploadItems.length > 0 ? (
                    <div className="space-y-2">
                        {uploadItems.map((uploadItem) => {
                            const progress =
                                uploadItem.status === 'uploaded'
                                    ? 100
                                    : clampUploadProgress(uploadItem.progress);
                            return (
                                <div
                                    key={uploadItem.id}
                                    className="rounded-md border px-3 py-2"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate font-medium">
                                                {uploadItem.file.name}
                                            </div>
                                            <div
                                                className={`text-xs ${getUploadItemStatusClassName(uploadItem)}`}
                                            >
                                                {getUploadItemStatusLabel(
                                                    uploadItem,
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">
                                                {progress}%
                                            </span>
                                            <IconButton
                                                title="Ukloni medij"
                                                type="button"
                                                variant="plain"
                                                size="sm"
                                                className="size-6 p-0"
                                                onClick={() =>
                                                    removeUploadItem(
                                                        uploadItem.id,
                                                    )
                                                }
                                                disabled={
                                                    uploadItem.status ===
                                                    'uploading'
                                                }
                                            >
                                                <Clear className="size-4" />
                                            </IconButton>
                                        </div>
                                    </div>
                                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className={`h-full transition-[width] duration-200 ${getUploadItemProgressClassName(uploadItem)}`}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    {uploadItem.status === 'failed' ? (
                                        <div className="mt-2">
                                            <Button
                                                type="button"
                                                variant="outlined"
                                                onClick={() =>
                                                    retryUploadItem(uploadItem)
                                                }
                                                disabled={isUploading}
                                            >
                                                Pokušaj ponovno
                                            </Button>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                ) : null}
                {errorMessage ? (
                    <p className="text-sm text-red-600">{errorMessage}</p>
                ) : null}
            </div>
        </div>
    );
}
