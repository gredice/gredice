import { RainIcon } from '@packages/game/hud/components/weather/icons/RainIcon';
import { WeatherArtwork } from '@packages/game/hud/components/weather/icons/WeatherArtwork';
import type { WeatherPart } from '@packages/game/hud/components/weather/icons/weatherComposition';
import { weatherDefinitions } from '@packages/game/hud/components/weather/icons/weatherDefinitions';
import { weatherIcons } from '@packages/game/hud/components/weather/WeatherIcons';
import Image from 'next/image';
import backpackSrc from '../../../../../garden/public/assets/hud/inventory-backpack.webp?url';
import basketSrc from '../../../../../garden/public/assets/hud/shopping-basket.webp?url';

const parts = [
    'sun',
    'moon',
    'cloud',
    'raindrop',
    'snowflake',
    'lightning',
    'fog',
] satisfies WeatherPart[];

export function WeatherIconsShowcase({ dark = false }: { dark?: boolean }) {
    return (
        <main
            className={`${dark ? 'dark bg-stone-900 text-stone-100' : 'bg-stone-100 text-stone-900'} min-h-screen p-4 sm:p-8`}
        >
            <div className="mx-auto max-w-7xl space-y-8">
                <header className="space-y-2">
                    <h1 className="text-2xl font-semibold">
                        Weather game icons
                    </h1>
                    <p className="max-w-3xl text-sm opacity-75">
                        Seven shared pieces compose all 42 conditions and their
                        day/night variants. Each pair is shown at 64px for
                        review and 24px as used in the HUD. Fog, mixed
                        precipitation and thunder retain their separate
                        meanings.
                    </p>
                </header>
                <section
                    aria-label="Shared weather artwork"
                    className="space-y-3"
                >
                    <h2 className="text-lg font-semibold">
                        Shared pieces and style references
                    </h2>
                    <div className="flex flex-wrap gap-x-6 gap-y-4">
                        {parts.map((part) => (
                            <figure
                                key={part}
                                className="space-y-2 text-center"
                            >
                                <svg
                                    viewBox="0 0 64 64"
                                    width={64}
                                    height={64}
                                    role="img"
                                    aria-label={part}
                                >
                                    <title>{part}</title>
                                    <WeatherArtwork
                                        part={part}
                                        x={4}
                                        y={4}
                                        width={56}
                                        height={56}
                                    />
                                </svg>
                                <figcaption className="text-xs opacity-75">
                                    {part}
                                </figcaption>
                            </figure>
                        ))}
                        {[
                            { src: backpackSrc, label: 'Backpack' },
                            { src: basketSrc, label: 'Basket' },
                        ].map(({ src, label }) => (
                            <figure
                                key={label}
                                className="space-y-2 text-center"
                            >
                                <Image
                                    src={src}
                                    alt={label}
                                    width={64}
                                    height={64}
                                    className="size-16 object-contain"
                                    unoptimized
                                />
                                <figcaption className="text-xs opacity-75">
                                    {label}
                                </figcaption>
                            </figure>
                        ))}
                    </div>
                </section>
                <section
                    aria-label="Precipitation indicator"
                    className="space-y-3"
                >
                    <h2 className="text-lg font-semibold">
                        Precipitation fill · 16px
                    </h2>
                    <div className="flex flex-wrap gap-6">
                        {[0, 25, 50, 75, 100].map((chance) => (
                            <div
                                key={chance}
                                className="flex items-center gap-1 text-xs"
                            >
                                <RainIcon chance={chance} />
                                {chance}%
                            </div>
                        ))}
                    </div>
                </section>
                <section
                    aria-label="All weather conditions"
                    className="space-y-3"
                >
                    <h2 className="text-lg font-semibold">
                        All conditions · day and night
                    </h2>
                    <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
                        {Object.entries(weatherDefinitions).map(
                            ([code, definition]) => (
                                <li
                                    key={code}
                                    data-weather-code={code}
                                    className="min-w-0 border-t border-current/15 py-4"
                                >
                                    <h3 className="min-h-10 text-sm">
                                        <span className="mr-2 font-mono opacity-50">
                                            {code.padStart(2, '0')}
                                        </span>
                                        {definition.label}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        {Object.entries(
                                            weatherIcons[Number(code)],
                                        ).map(([period, Icon]) => (
                                            <div key={period}>
                                                <p className="text-xs opacity-60">
                                                    {period === 'day'
                                                        ? 'Day'
                                                        : 'Night'}
                                                </p>
                                                <div className="flex items-center gap-3">
                                                    <Icon className="size-16 shrink-0" />
                                                    <Icon
                                                        className="size-6 shrink-0"
                                                        aria-hidden="true"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </li>
                            ),
                        )}
                    </ul>
                </section>
            </div>
        </main>
    );
}
