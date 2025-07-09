import Image from "next/image";
import { OperationData } from "../../lib/plants/getOperationsData";

export function OperationImage({ operation }: { operation: Partial<Pick<OperationData, "image" | "information">> }) {
    if (!operation.image?.cover?.url) {
        return (
            <span className="size-[32px] text-3xl">🪏</span>
        );
    }

    return (
        <Image
            src={operation.image.cover.url}
            width={32}
            height={32}
            style={{
                objectFit: 'contain',
                width: '32px',
                height: '32px'
            }}
            alt={operation.information?.label ?? "Slika operacije"} />
    );
}
