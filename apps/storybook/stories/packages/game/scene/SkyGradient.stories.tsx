import {
    gameBackgroundPalettes,
    getGameBackgroundPaletteIndexByKey,
    resolveEnvironmentSkyBackgroundColors,
    resolveMoonlitNightScales,
    resolveSkyBackgroundColor,
    resolveSkyGradientColors,
    type SkyGradientWeather,
} from '@gredice/game';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useMemo } from 'react';

type ColorLike = {
    b: number;
    clone: () => ColorLike;
    convertLinearToSRGB?: () => ColorLike;
    g: number;
    r: number;
};

type SkyGradientStoryProps = {
    cloudy: number;
    foggy: number;
    moonlight: number;
    moonVisibility: number;
    moonX: number;
    moonY: number;
    paletteKey: string;
    rainy: number;
    snowy: number;
    sunVisibility: number;
    sunX: number;
    sunY: number;
    thundery: number;
    timeOfDay: number;
};

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

function colorToRgb(color: ColorLike) {
    const displayColor = color.clone();
    displayColor.convertLinearToSRGB?.();
    return [
        Math.round(clamp01(displayColor.r) * 255),
        Math.round(clamp01(displayColor.g) * 255),
        Math.round(clamp01(displayColor.b) * 255),
    ];
}

function colorToCss(color: ColorLike) {
    const [red, green, blue] = colorToRgb(color);
    return `rgb(${red} ${green} ${blue})`;
}

function colorToCssAlpha(color: ColorLike, alpha: number) {
    const [red, green, blue] = colorToRgb(color);
    return `rgb(${red} ${green} ${blue} / ${clamp01(alpha).toFixed(3)})`;
}

function screenPositionToCss(value: number) {
    return `${((value + 1) / 2) * 100}%`;
}

function screenPositionYToCss(value: number) {
    return `${(1 - (value + 1) / 2) * 100}%`;
}

function formatTimeOfDay(timeOfDay: number) {
    const totalMinutes = Math.round(timeOfDay * 24 * 60) % (24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}`;
}

function useSkyGradientPreview({
    cloudy,
    foggy,
    moonlight,
    paletteKey,
    rainy,
    snowy,
    thundery,
    timeOfDay,
}: Pick<
    SkyGradientStoryProps,
    | 'cloudy'
    | 'foggy'
    | 'moonlight'
    | 'paletteKey'
    | 'rainy'
    | 'snowy'
    | 'thundery'
    | 'timeOfDay'
>) {
    return useMemo(() => {
        const backgroundPaletteIndex =
            getGameBackgroundPaletteIndexByKey(paletteKey);
        const weather: SkyGradientWeather = {
            cloudy,
            foggy,
            rainy,
            snowy,
            thundery,
        };
        const baseColors = resolveEnvironmentSkyBackgroundColors({
            backgroundPaletteIndex,
            timeOfDay,
        });
        const moonlitNightScales = resolveMoonlitNightScales({
            moonlight,
            timeOfDay,
        });
        const backgroundColor = resolveSkyBackgroundColor({
            background: baseColors.background,
            moonlitSkyScale: moonlitNightScales.skyScale,
            weather,
        });
        const gradient = resolveSkyGradientColors({
            backgroundColor,
            backgroundPaletteIndex,
            moonlight,
            timeOfDay,
            weather,
        });

        return { backgroundColor, gradient };
    }, [
        cloudy,
        foggy,
        moonlight,
        paletteKey,
        rainy,
        snowy,
        thundery,
        timeOfDay,
    ]);
}

function buildSkyGradientCss({
    gradient,
    moonVisibility,
    moonX,
    moonY,
    sunVisibility,
    sunX,
    sunY,
}: Pick<
    SkyGradientStoryProps,
    'moonVisibility' | 'moonX' | 'moonY' | 'sunVisibility' | 'sunX' | 'sunY'
> & {
    gradient: ReturnType<typeof useSkyGradientPreview>['gradient'];
}) {
    return [
        `radial-gradient(circle at ${screenPositionToCss(sunX)} ${screenPositionYToCss(sunY)}, rgb(255 255 255 / ${clamp01(
            gradient.sunGlowIntensity * sunVisibility * 0.62,
        ).toFixed(3)}) 0%, rgb(255 255 255 / 0) 18%)`,
        `radial-gradient(circle at ${screenPositionToCss(sunX)} ${screenPositionYToCss(sunY)}, ${colorToCssAlpha(
            gradient.sunGlow,
            gradient.sunGlowIntensity * sunVisibility,
        )} 0%, ${colorToCssAlpha(gradient.sunGlow, 0)} 42%)`,
        `radial-gradient(circle at ${screenPositionToCss(moonX)} ${screenPositionYToCss(moonY)}, ${colorToCssAlpha(
            gradient.moonGlow,
            gradient.moonGlowIntensity * moonVisibility,
        )} 0%, ${colorToCssAlpha(gradient.moonGlow, 0)} 36%)`,
        `linear-gradient(180deg, ${colorToCss(gradient.zenith)} 0%, ${colorToCss(
            gradient.upper,
        )} 28%, ${colorToCss(gradient.horizon)} 68%, ${colorToCss(
            gradient.lower,
        )} 100%)`,
    ].join(', ');
}

function SkyGradientSurface({
    className,
    gradient,
    props,
}: {
    className: string;
    gradient: ReturnType<typeof useSkyGradientPreview>['gradient'];
    props: SkyGradientStoryProps;
}) {
    const {
        moonVisibility,
        moonX,
        moonY,
        sunVisibility,
        sunX,
        sunY,
        timeOfDay,
    } = props;
    const background = buildSkyGradientCss({ gradient, ...props });

    return (
        <div
            className={`relative overflow-hidden rounded-md border border-border ${className}`}
            style={{ background }}
        >
            <div
                className="absolute size-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_42px_rgba(255,242,196,0.78)]"
                style={{
                    left: screenPositionToCss(sunX),
                    opacity: clamp01(sunVisibility),
                    top: screenPositionYToCss(sunY),
                }}
            />
            <div
                className="absolute size-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-100 shadow-[0_0_24px_rgba(217,232,255,0.58)]"
                style={{
                    left: screenPositionToCss(moonX),
                    opacity: clamp01(moonVisibility),
                    top: screenPositionYToCss(moonY),
                }}
            />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/10 to-transparent" />
            <div className="absolute bottom-4 left-4 rounded-md bg-background/80 px-3 py-2 text-sm shadow-sm backdrop-blur">
                <span className="tabular-nums">
                    {formatTimeOfDay(timeOfDay)}
                </span>
            </div>
        </div>
    );
}

function SkyGradientPreview(props: SkyGradientStoryProps) {
    const { backgroundColor, gradient } = useSkyGradientPreview(props);
    const swatches = [
        ['Zenith', gradient.zenith],
        ['Upper', gradient.upper],
        ['Horizon', gradient.horizon],
        ['Lower', gradient.lower],
        ['Sun glow', gradient.sunGlow],
        ['Moon glow', gradient.moonGlow],
    ] satisfies Array<[string, ColorLike]>;

    return (
        <div className="min-h-screen bg-background p-4 text-foreground sm:p-6">
            <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <SkyGradientSurface
                    className="min-h-[28rem]"
                    gradient={gradient}
                    props={props}
                />
                <div className="grid content-start gap-3 rounded-md border border-border bg-background p-4">
                    <div>
                        <div className="text-sm font-medium">Base</div>
                        <div
                            className="mt-1 h-8 rounded-sm border border-border"
                            style={{ background: colorToCss(backgroundColor) }}
                        />
                    </div>
                    {swatches.map(([label, color]) => (
                        <div
                            className="grid grid-cols-[5rem_1fr] items-center gap-3 text-sm"
                            key={label}
                        >
                            <span className="text-muted-foreground">
                                {label}
                            </span>
                            <span
                                className="h-8 rounded-sm border border-border"
                                style={{ background: colorToCss(color) }}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function PaletteTile({
    args,
    paletteKey,
}: {
    args: SkyGradientStoryProps;
    paletteKey: string;
}) {
    const props = { ...args, paletteKey };
    const { gradient } = useSkyGradientPreview(props);
    const palette = gameBackgroundPalettes.find(
        (backgroundPalette) => backgroundPalette.key === paletteKey,
    );

    return (
        <div className="grid overflow-hidden rounded-md border border-border bg-background">
            <SkyGradientSurface
                className="aspect-[5/3]"
                gradient={gradient}
                props={props}
            />
            <div className="border-t border-border px-3 py-2 text-sm font-medium">
                {palette?.label ?? paletteKey}
            </div>
        </div>
    );
}

function PaletteSweep(args: SkyGradientStoryProps) {
    return (
        <div className="grid min-h-screen gap-4 bg-background p-4 text-foreground sm:grid-cols-2 lg:grid-cols-3">
            {gameBackgroundPalettes.map((palette) => (
                <PaletteTile
                    args={args}
                    key={palette.key}
                    paletteKey={palette.key}
                />
            ))}
        </div>
    );
}

const meta = {
    title: 'packages/game/scene/SkyGradient',
    component: SkyGradientPreview,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Shared sky-gradient resolver used by the garden scene background, with controls for palette, weather, moonlight, and projected sun/moon placement.',
            },
        },
    },
    argTypes: {
        paletteKey: {
            control: 'select',
            options: gameBackgroundPalettes.map((palette) => palette.key),
        },
        timeOfDay: {
            control: { type: 'range', min: 0, max: 1, step: 0.01 },
        },
        cloudy: {
            control: { type: 'range', min: 0, max: 1, step: 0.01 },
        },
        foggy: {
            control: { type: 'range', min: 0, max: 1, step: 0.01 },
        },
        rainy: {
            control: { type: 'range', min: 0, max: 1, step: 0.01 },
        },
        snowy: {
            control: { type: 'range', min: 0, max: 1, step: 0.01 },
        },
        thundery: {
            control: { type: 'range', min: 0, max: 1, step: 0.01 },
        },
        moonlight: {
            control: { type: 'range', min: 0, max: 1, step: 0.01 },
        },
        sunX: {
            control: { type: 'range', min: -1.4, max: 1.4, step: 0.01 },
        },
        sunY: {
            control: { type: 'range', min: -1.2, max: 1.2, step: 0.01 },
        },
        sunVisibility: {
            control: { type: 'range', min: 0, max: 1, step: 0.01 },
        },
        moonX: {
            control: { type: 'range', min: -1.4, max: 1.4, step: 0.01 },
        },
        moonY: {
            control: { type: 'range', min: -1.2, max: 1.2, step: 0.01 },
        },
        moonVisibility: {
            control: { type: 'range', min: 0, max: 1, step: 0.01 },
        },
    },
    args: {
        paletteKey: 'current',
        timeOfDay: 0.72,
        cloudy: 0,
        foggy: 0,
        rainy: 0,
        snowy: 0,
        thundery: 0,
        moonlight: 0.45,
        sunX: 0.48,
        sunY: 0.52,
        sunVisibility: 1,
        moonX: -0.52,
        moonY: 0.42,
        moonVisibility: 0.18,
    },
} satisfies Meta<typeof SkyGradientPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tuning: Story = {};

export const NeutralNoon: Story = {
    args: {
        paletteKey: 'current',
        timeOfDay: 0.5,
        sunX: 0.32,
        sunY: 0.64,
        sunVisibility: 1,
        moonVisibility: 0,
    },
};

export const Night: Story = {
    args: {
        paletteKey: 'current',
        timeOfDay: 0.92,
        moonlight: 0.8,
        sunVisibility: 0,
        moonX: -0.16,
        moonY: 0.62,
        moonVisibility: 1,
    },
};

export const AllPalettes: Story = {
    render: (args) => <PaletteSweep {...args} />,
};
