import Image, { ImageProps } from 'next/image';

type BlockImageProps = Omit<ImageProps, 'src' | 'alt'> & {
    blockName: string;
    alt?: string;
};

export function BlockImage({ alt, blockName, ...rest }: BlockImageProps) {
    return (
        <Image
            src={`https://www.gredice.com/assets/blocks/${blockName}.png`}
            alt={alt || blockName}
            {...rest}
        />
    );
}
