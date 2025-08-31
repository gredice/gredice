'use client';

import { ImageEditor } from '@gredice/ui/ImageEditor';
import { Button } from '@signalco/ui-primitives/Button';
import { Stack } from '@signalco/ui-primitives/Stack';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { uploadAttributeImage } from '../../../../app/(actions)/entityActions';
import type { AttributeInputProps } from '../AttributeInputProps';

export function ImageInput({
    value,
    onChange,
    attributeDefinition,
}: AttributeInputProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [editorFile, setEditorFile] = useState<File | null>(null);
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

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setEditorFile(file);
    };

    const handleSave = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const { url } = await uploadAttributeImage(formData);
        await onChange(JSON.stringify({ url }));
        setEditorFile(null);
    };

    return (
        <Stack spacing={2}>
            {imageUrl ? (
                <Image
                    src={imageUrl}
                    alt={attributeDefinition?.label || 'attribute image'}
                    width={200}
                    height={200}
                    className="object-contain"
                />
            ) : (
                urlText && (
                    <a href={urlText} className="text-blue-600 underline">
                        {urlText}
                    </a>
                )
            )}
            <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
            />
            <Button onClick={triggerFileInput}>
                {imageUrl ? 'Zamijeni sliku' : 'Dodaj sliku'}
            </Button>
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
