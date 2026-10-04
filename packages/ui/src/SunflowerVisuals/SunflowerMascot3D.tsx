import type { SVGProps } from 'react';
import { GameIconFrame } from '../GameIcons/GameIconFrame';
import artwork from './assets/mascot-3d.webp';
import giftArtwork from './assets/mascot-gift-3d.webp';
import sadArtwork from './assets/mascot-sad-3d.webp';

const expressions = {
    happy: { artwork, label: 'Suncokret' },
    sad: { artwork: sadArtwork, label: 'Tužan suncokret' },
    gift: { artwork: giftArtwork, label: 'Suncokret s poklonom' },
};

/** Bundled mascot expressions work without an image optimizer or remote CDN. */
export function SunflowerMascot3D({
    expression = 'happy',
    ...props
}: SVGProps<SVGSVGElement> & { expression?: keyof typeof expressions }) {
    const { artwork: source, label } = expressions[expression];
    return <GameIconFrame source={source} label={label} {...props} />;
}
