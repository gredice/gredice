'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

type ImageUploadPreviewProps = {
    file: File;
};

export function ImageUploadPreview({ file }: ImageUploadPreviewProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        const nextPreviewUrl = URL.createObjectURL(file);
        setPreviewUrl(nextPreviewUrl);

        return () => URL.revokeObjectURL(nextPreviewUrl);
    }, [file]);

    if (!previewUrl) {
        return <div className="aspect-[4/3] w-full animate-pulse bg-muted" />;
    }

    return (
        <Image
            src={previewUrl}
            alt=""
            width={240}
            height={180}
            unoptimized
            className="aspect-[4/3] w-full bg-muted object-cover"
        />
    );
}
