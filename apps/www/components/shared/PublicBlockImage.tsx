'use client';

import { BlockImage } from '@gredice/ui/BlockImage';
import type { ComponentProps } from 'react';
import { generatedBlockImageLoader } from '../../lib/images/generatedBlockImageLoader';

export function PublicBlockImage(props: ComponentProps<typeof BlockImage>) {
    return <BlockImage {...props} loader={generatedBlockImageLoader} />;
}
