import Image, { type ImageProps } from 'next/image';
import { getBlockImageUrl } from './blockImageUrl';

type BlockImageProps = Omit<ImageProps, 'src' | 'alt'> & {
    blockName: string;
    alt?: string;
    rotationSuffix?: number | string;
};

export function BlockImage({
    alt,
    blockName,
    rotationSuffix,
    ...rest
}: BlockImageProps) {
    const src = getBlockImageUrl(blockName, { rotationSuffix }) ?? '';

    return <Image src={src} alt={alt || blockName} {...rest} />;
}
