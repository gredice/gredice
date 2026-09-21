import Image from 'next/image';
import day from './assets/footer-day.webp';
import night from './assets/footer-night.webp';
import sunrise from './assets/footer-sunrise.webp';
import sunset from './assets/footer-sunset.webp';
import type { PublicEnvironmentSnapshot } from './publicEnvironment';

const landscapes = { day, night, sunrise, sunset };

export function PublicFooterLandscape({
    phase = 'day',
}: {
    phase?: PublicEnvironmentSnapshot['phase'] | null;
}) {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none relative h-[clamp(12rem,33.333vw,36rem)] w-full select-none overflow-hidden"
            data-footer-phase={phase ?? 'loading'}
            data-testid="public-footer-landscape"
            style={{
                maskImage: 'linear-gradient(180deg, transparent 0%, #000 42%)',
            }}
        >
            {phase ? (
                <Image
                    alt=""
                    className="object-cover object-bottom"
                    fill
                    loading="lazy"
                    sizes="100vw"
                    src={landscapes[phase]}
                />
            ) : null}
        </div>
    );
}
