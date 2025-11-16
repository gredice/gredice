import { Hammer } from '@signalco/ui-icons';
import Image from 'next/image';

export type OperationImageProps = {
    operation: {
        image?: {
            cover?: {
                url?: string;
            };
        };
        information?: {
            label?: string;
        };
    };
    size?: number;
};

export function OperationImage({ operation, size }: OperationImageProps) {
    if (!operation.image?.cover?.url) {
        return (
            <div
                style={{
                    width: size ? `${size}px` : '48px',
                    height: size ? `${size}px` : '48px',
                }}
                className="aspect-square flex items-center justify-center"
            >
                <Hammer
                    style={
                        {
                            '--imageSize': size ? `${size / 2}px` : '24px',
                        } as React.CSSProperties
                    }
                    className="size-[--imageSize] shrink-0"
                />
            </div>
        );
    }

    return (
        <Image
            src={operation.image.cover.url}
            width={size ?? 24}
            height={size ?? 24}
            style={{
                objectFit: 'contain',
                width: `${size ?? 24}px`,
                height: `${size ?? 24}px`,
            }}
            alt={operation.information?.label ?? 'Slika operacije'}
        />
    );
}
