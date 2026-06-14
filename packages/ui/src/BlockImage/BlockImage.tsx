import Image, { type ImageProps } from 'next/image';
import { getBlockImageUrl } from './blockImageUrl';

type BlockImageProps = Omit<ImageProps, 'src' | 'alt'> & {
    blockName: string;
    alt?: string;
};

export function BlockImage({ alt, blockName, ...rest }: BlockImageProps) {
    const src = getBlockImageUrl(blockName) ?? '';

    return <Image src={src} alt={alt || blockName} {...rest} />;
}
