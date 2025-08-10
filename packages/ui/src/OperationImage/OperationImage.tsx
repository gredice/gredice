import Image from "next/image";
import { Hammer } from "@signalco/ui-icons";

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
            <Hammer
                style={{
                    "--imageSize": size ? `${size}px` : '32px',
                } as React.CSSProperties}
                className="size-[--imageSize] shrink-0" />
        );
    }

    return (
        <Image
            src={operation.image.cover.url}
            width={size ?? 32}
            height={size ?? 32}
            style={{
                objectFit: 'contain',
                width: `${size ?? 32}px`,
                height: `${size ?? 32}px`
            }}
            alt={operation.information?.label ?? "Slika operacije"} />
    );
}
