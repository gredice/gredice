import Image, { ImageProps } from "next/image";

export function BlockImage({ blockName, ...rest }: Omit<ImageProps, 'src' | 'alt'> & { blockName: string }) {
    return (
        <Image
            src={`/assets/blocks/${blockName}.png`}
            alt={blockName}
            {...rest}
        />
    );
}