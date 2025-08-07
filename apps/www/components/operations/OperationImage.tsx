import Image from "next/image";
import { OperationData } from "../../lib/plants/getOperationsData";
import { Hammer } from "@signalco/ui-icons";

export function OperationImage({ operation, size }: { operation: Partial<Pick<OperationData, "image" | "information">>, size?: number }) {
    if (!operation.image?.cover?.url) {
        return (
            <Hammer
                style={{
                    "--imageSize": size ? `${size}px` : '32px',
                } as React.CSSProperties}
                className="size-[--imageSize]">🪏</Hammer>
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
