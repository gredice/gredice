'use client';

import { ImageEditor } from '@gredice/ui/ImageEditor';
import { Upload } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { cx } from '@gredice/ui/utils';
import Image from 'next/image';
import { type ChangeEvent, type DragEvent, useRef, useState } from 'react';
import { uploadAttributeImage } from '../../../../app/(actions)/entityActions';
import type { AttributeInputProps } from '../AttributeInputProps';

export function ImageInput({
    value,
    onChange,
    attributeDefinition,
}: AttributeInputProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [editorFile, setEditorFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    let imageUrl: string | null = null;
    let urlText: string | null = null;

    if (value) {
        try {
            const data = JSON.parse(value);
            if (data && typeof data.url === 'string') {
                imageUrl = data.url;
            } else {
                urlText = value;
            }
        } catch {
            urlText = value;
        }
    }

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleFile = (file: File | undefined) => {
        if (!file?.type.startsWith('image/')) {
            return;
        }

        setEditorFile(file);
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        handleFile(event.target.files?.[0]);
        event.target.value = '';
    };

    const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
        event.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (event: DragEvent<HTMLButtonElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsDragging(false);
        }
    };

    const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
        event.preventDefault();
        setIsDragging(false);
        handleFile(event.dataTransfer.files?.[0]);
    };

    const handleSave = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const { url } = await uploadAttributeImage(formData);
        await onChange(JSON.stringify({ url }));
        setEditorFile(null);
    };

    return (
        <Stack spacing={4}>
            <button
                type="button"
                aria-label={imageUrl ? 'Zamijeni sliku' : 'Dodaj sliku'}
                onClick={triggerFileInput}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cx(
                    'group flex min-h-48 w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-input bg-background text-left transition-colors',
                    'hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    imageUrl && 'border-solid',
                    isDragging && 'border-primary bg-primary/10',
                )}
            >
                {imageUrl ? (
                    <Image
                        src={imageUrl}
                        alt={attributeDefinition?.label || 'attribute image'}
                        width={640}
                        height={360}
                        className="max-h-80 w-full rounded-md object-contain p-2 transition-transform group-hover:scale-[1.01]"
                    />
                ) : (
                    <span className="flex flex-col items-center gap-2 px-6 py-10 text-center text-muted-foreground">
                        <span className="flex size-10 items-center justify-center rounded-full border border-input bg-muted/40">
                            <Upload className="size-5" />
                        </span>
                        <span className="text-sm font-medium text-foreground">
                            Povucite sliku ovdje
                        </span>
                        <span className="text-xs">
                            ili kliknite za odabir datoteke
                        </span>
                        {urlText && (
                            <span className="max-w-full truncate text-xs text-muted-foreground">
                                {urlText}
                            </span>
                        )}
                    </span>
                )}
            </button>
            <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
            />
            {editorFile && (
                <ImageEditor
                    file={editorFile}
                    onSave={handleSave}
                    onCancel={() => setEditorFile(null)}
                />
            )}
        </Stack>
    );
}
