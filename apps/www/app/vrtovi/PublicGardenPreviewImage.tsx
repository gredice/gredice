'use client';

import { Sprout } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import Image from 'next/image';
import { useState } from 'react';
import { getPublicGardenOgImageUrl } from './publicGardenUrls';

const gardenPreviewPlantDots = [
    'dot-1',
    'dot-2',
    'dot-3',
    'dot-4',
    'dot-5',
    'dot-6',
    'dot-7',
    'dot-8',
    'dot-9',
    'dot-10',
];

export function PublicGardenPreviewImage({
    gardenId,
    gardenName,
    priority = false,
}: {
    gardenId: number;
    gardenName: string;
    priority?: boolean;
}) {
    const [imageFailed, setImageFailed] = useState(false);

    return (
        <div className="relative aspect-[1200/630] w-full overflow-hidden bg-[#dce8b8]">
            <div
                aria-hidden={!imageFailed}
                aria-label={`Ilustrirani prikaz vrta ${gardenName}`}
                className="absolute inset-0 overflow-hidden"
                role="img"
                style={{
                    backgroundImage:
                        'linear-gradient(145deg, #eff3cf 0%, #dce8b8 45%, #b9d48d 100%)',
                }}
            >
                <div className="absolute -top-8 -right-6 size-36 rounded-full bg-[#79ad64]/70 shadow-[inset_-12px_-14px_0_rgba(56,103,56,0.16)]" />
                <div className="absolute top-[26%] left-[14%] h-[32%] w-[58%] -rotate-6 rounded-[18%] border-[10px] border-[#a86f4d] bg-[#593a2a] shadow-xl">
                    <div className="grid size-full grid-cols-5 gap-2 overflow-hidden p-3 opacity-90">
                        {gardenPreviewPlantDots.map((dot) => (
                            <span
                                className="rounded-full bg-[#77b255] shadow-sm"
                                key={dot}
                            />
                        ))}
                    </div>
                </div>
                <div className="absolute right-[9%] bottom-[22%] h-[14%] w-[28%] rotate-6 rounded-[20%] border-[7px] border-[#bb805d] bg-[#674533] shadow-lg" />
                <div className="absolute inset-x-0 bottom-0 flex h-[28%] items-center gap-2 bg-background/92 px-4 text-primary backdrop-blur-sm">
                    <Sprout aria-hidden className="size-5 shrink-0" />
                    <span className="truncate text-sm font-semibold">
                        {gardenName}
                    </span>
                </div>
            </div>
            {!imageFailed ? (
                <Image
                    src={getPublicGardenOgImageUrl(gardenId)}
                    alt={`Prikaz vrta ${gardenName}`}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    priority={priority}
                    className={cx(
                        'object-cover transition-[opacity,transform] duration-300 group-hover:scale-[1.02]',
                        imageFailed && 'opacity-0',
                    )}
                    onError={() => setImageFailed(true)}
                />
            ) : null}
        </div>
    );
}
