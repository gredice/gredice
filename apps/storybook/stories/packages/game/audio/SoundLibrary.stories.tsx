import { Button } from '@gredice/ui/Button';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useCallback, useEffect, useRef, useState } from 'react';

const soundGroups = [
    {
        id: 'ambient',
        title: 'Ambient loops',
        description:
            'Long-running garden atmosphere. Start a preset, then play effects over it to judge the complete soundscape.',
        sounds: [
            {
                id: 'morning',
                name: 'Morning',
                context: 'Dawn garden ambience',
                src: 'https://cdn.gredice.com/sounds/ambient/Morning 01.mp3',
            },
            {
                id: 'day-birds',
                name: 'Day birds',
                context: 'Clear daytime ambience',
                src: 'https://cdn.gredice.com/sounds/ambient/Day Birds 01.mp3',
            },
            {
                id: 'night',
                name: 'Night',
                context: 'Night-time garden ambience',
                src: 'https://cdn.gredice.com/sounds/ambient/Night 01.mp3',
            },
            {
                id: 'day-rain',
                name: 'Day rain',
                context: 'Rainy daytime base layer',
                src: 'https://cdn.gredice.com/sounds/ambient/Day Rain 01.mp3',
            },
            {
                id: 'rain-heavy',
                name: 'Heavy rain',
                context: 'Heavy-rain ambience',
                src: 'https://cdn.gredice.com/sounds/ambient/Rain Heavy 01.mp3',
            },
            {
                id: 'rain-light-modifier',
                name: 'Light rain modifier',
                context: 'Additional light-rain layer',
                src: 'https://cdn.gredice.com/sounds/ambient/Mod Rain Light 01.mp3',
            },
            {
                id: 'rain-medium-modifier',
                name: 'Medium rain modifier',
                context: 'Additional medium-rain layer',
                src: 'https://cdn.gredice.com/sounds/ambient/Mod Rain Medium 01.mp3',
            },
        ],
    },
    {
        id: 'effects',
        title: 'Interaction effects',
        description:
            'Short feedback sounds used while arranging blocks in the garden.',
        sounds: [
            {
                id: 'pick-grass',
                name: 'Pick grass',
                context: 'Picking up a garden block',
                src: 'https://cdn.gredice.com/sounds/effects/Pick Grass 01.mp3',
            },
            {
                id: 'drop-grass',
                name: 'Drop grass',
                context: 'Placing a garden block',
                src: 'https://cdn.gredice.com/sounds/effects/Drop Grass 01.mp3',
            },
            {
                id: 'swipe-generic',
                name: 'Generic swipe',
                context: 'Rotating or swiping a garden block',
                src: 'https://cdn.gredice.com/sounds/effects/Swipe Generic 01.mp3',
            },
        ],
    },
] as const;

type SoundId = (typeof soundGroups)[number]['sounds'][number]['id'];

const ambiencePresets = [
    {
        name: 'Morning',
        description: 'Dawn ambience',
        soundIds: ['morning'],
    },
    {
        name: 'Clear day',
        description: 'Daytime birds',
        soundIds: ['day-birds'],
    },
    {
        name: 'Light rain',
        description: 'Day rain on its own',
        soundIds: ['day-rain'],
    },
    {
        name: 'Steady rain',
        description: 'Day rain with its light modifier',
        soundIds: ['day-rain', 'rain-light-modifier'],
    },
    {
        name: 'Medium rain comparison',
        description: 'Day rain with its medium modifier',
        soundIds: ['day-rain', 'rain-medium-modifier'],
    },
    {
        name: 'Heavy rain',
        description: 'Heavy-rain ambience on its own',
        soundIds: ['rain-heavy'],
    },
    {
        name: 'Night',
        description: 'Night-time ambience',
        soundIds: ['night'],
    },
] as const satisfies ReadonlyArray<{
    name: string;
    description: string;
    soundIds: ReadonlyArray<SoundId>;
}>;

const soundCount = soundGroups.reduce(
    (count, group) => count + group.sounds.length,
    0,
);

function SoundLibrary() {
    const audioElements = useRef(new Map<SoundId, HTMLAudioElement>());
    const [masterVolume, setMasterVolume] = useState(70);

    const stopAll = useCallback(() => {
        for (const audio of audioElements.current.values()) {
            audio.pause();
            audio.currentTime = 0;
        }
    }, []);

    useEffect(() => {
        const volume = masterVolume / 100;
        for (const audio of audioElements.current.values()) {
            audio.volume = volume;
        }
    }, [masterVolume]);

    useEffect(() => stopAll, [stopAll]);

    const playPreset = async (soundIds: ReadonlyArray<SoundId>) => {
        stopAll();

        await Promise.allSettled(
            soundIds.map((soundId) => {
                const audio = audioElements.current.get(soundId);
                if (!audio) {
                    return Promise.resolve();
                }

                audio.currentTime = 0;
                return audio.play();
            }),
        );
    };

    return (
        <main className="min-h-screen bg-background p-4 text-foreground sm:p-6 lg:p-8">
            <div className="mx-auto max-w-6xl space-y-8">
                <header className="space-y-3">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">
                                Garden audio · {soundCount} sounds
                            </p>
                            <h1 className="text-3xl font-semibold tracking-tight">
                                Sound library
                            </h1>
                        </div>
                        <Button
                            color="neutral"
                            variant="outlined"
                            onClick={stopAll}
                        >
                            Stop all sounds
                        </Button>
                    </div>
                    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                        Audition every sound currently referenced by the garden
                        game. Ambient tracks loop and can overlap, so you can
                        compare layers or keep a preset running while testing
                        interaction effects.
                    </p>
                </header>

                <section
                    aria-labelledby="master-volume-heading"
                    className="rounded-lg border border-border bg-card p-4"
                >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2
                                id="master-volume-heading"
                                className="font-medium"
                            >
                                Master audition volume
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Changes the volume of every player on this page.
                            </p>
                        </div>
                        <div className="flex min-w-0 items-center gap-3 sm:w-80">
                            <input
                                aria-label="Master audition volume"
                                className="min-w-0 flex-1 accent-primary"
                                max={100}
                                min={0}
                                type="range"
                                value={masterVolume}
                                onChange={(event) =>
                                    setMasterVolume(
                                        Number(event.currentTarget.value),
                                    )
                                }
                            />
                            <output className="w-11 text-right text-sm tabular-nums">
                                {masterVolume}%
                            </output>
                        </div>
                    </div>
                </section>

                <section
                    aria-labelledby="presets-heading"
                    className="space-y-3"
                >
                    <div>
                        <h2
                            id="presets-heading"
                            className="text-xl font-semibold"
                        >
                            Ambience presets
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Each preset stops the current mix before starting a
                            new one.
                        </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {ambiencePresets.map((preset) => (
                            <button
                                key={preset.name}
                                className="rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                type="button"
                                onClick={() => void playPreset(preset.soundIds)}
                            >
                                <span className="block font-medium">
                                    {preset.name}
                                </span>
                                <span className="mt-1 block text-sm text-muted-foreground">
                                    {preset.description}
                                </span>
                            </button>
                        ))}
                    </div>
                </section>

                {soundGroups.map((group) => (
                    <section
                        key={group.id}
                        aria-labelledby={`${group.id}-heading`}
                        className="space-y-3"
                    >
                        <div>
                            <h2
                                id={`${group.id}-heading`}
                                className="text-xl font-semibold"
                            >
                                {group.title}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {group.description}
                            </p>
                        </div>
                        <div className="grid gap-3 lg:grid-cols-2">
                            {group.sounds.map((sound) => (
                                <article
                                    key={sound.id}
                                    className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_minmax(260px,0.9fr)] sm:items-center"
                                >
                                    <div className="min-w-0">
                                        <h3 className="font-medium">
                                            {sound.name}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {sound.context}
                                        </p>
                                        <p className="mt-2 truncate font-mono text-xs text-muted-foreground">
                                            {decodeURIComponent(
                                                new URL(sound.src).pathname
                                                    .split('/')
                                                    .at(-1) ?? sound.src,
                                            )}
                                        </p>
                                    </div>
                                    {/* biome-ignore lint/a11y/useMediaCaption: These non-verbal ambience and effect clips are described by the adjacent text and accessible label. */}
                                    <audio
                                        ref={(element) => {
                                            if (element) {
                                                element.volume =
                                                    masterVolume / 100;
                                                audioElements.current.set(
                                                    sound.id,
                                                    element,
                                                );
                                            } else {
                                                audioElements.current.delete(
                                                    sound.id,
                                                );
                                            }
                                        }}
                                        aria-label={`${sound.name}: ${sound.context}`}
                                        className="h-10 w-full"
                                        controls
                                        loop={group.id === 'ambient'}
                                        preload="metadata"
                                        src={sound.src}
                                    />
                                </article>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </main>
    );
}

const meta = {
    title: 'packages/game/audio/Sound Library',
    component: SoundLibrary,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'A single audition surface for every ambient loop and interaction effect currently referenced by the garden game, including layered ambience presets.',
            },
        },
        layout: 'fullscreen',
    },
} satisfies Meta<typeof SoundLibrary>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllSounds: Story = {};
