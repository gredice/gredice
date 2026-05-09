import type { ImageProps } from 'next/image';
import Image from 'next/image';

export function SantaCapIcon(props: Omit<ImageProps, 'src' | 'alt'>) {
    return (
        <Image
            src="https://cdn.gredice.com/assets/advent-hat-512x493.png"
            alt="Adventska kapica"
            width={48}
            height={48}
            className="object-contain drop-shadow-lg"
            {...props}
        />
    );
}
