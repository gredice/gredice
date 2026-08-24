import {
    type PublicEnvironmentWeatherKind,
    PublicSkyBackdrop,
    publicEnvironmentWeatherPresets,
    resolvePublicEnvironmentDateAtMinutes,
    resolvePublicEnvironmentSnapshot,
} from '@gredice/ui/PublicChrome';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

type PublicEnvironmentPreviewProps = {
    hour: number;
    weatherKind: Exclude<PublicEnvironmentWeatherKind, 'live'>;
};

function PublicEnvironmentPreview({
    hour,
    weatherKind,
}: PublicEnvironmentPreviewProps) {
    const date = resolvePublicEnvironmentDateAtMinutes(
        new Date('2026-08-24T12:00:00Z'),
        hour * 60,
    );
    const weather = publicEnvironmentWeatherPresets[weatherKind];
    const snapshot = resolvePublicEnvironmentSnapshot({ date, weather });

    return (
        <div
            className={`relative isolate min-h-[36rem] w-[min(72rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border text-foreground ${snapshot.dark ? 'dark' : ''}`}
        >
            <PublicSkyBackdrop
                position="absolute"
                snapshot={snapshot}
                weather={weather}
            />
            <div className="grid min-h-[36rem] content-between gap-12 p-6 sm:p-10">
                <div className="max-w-xl rounded-2xl border border-border/70 bg-background/80 p-6 shadow-lg backdrop-blur-xl">
                    <p className="text-sm font-semibold text-muted-foreground">
                        Gredice
                    </p>
                    <h1 className="mt-2 text-3xl font-bold">
                        Vrt koji prati ritam dana
                    </h1>
                    <p className="mt-3 text-muted-foreground">
                        Pregled pozadine, prilagođene teme i kontrasta na javnim
                        stranicama.
                    </p>
                </div>
                <div className="justify-self-end rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm tabular-nums shadow-sm backdrop-blur-xl">
                    {hour.toString().padStart(2, '0')}:00 · {weatherKind}
                </div>
            </div>
        </div>
    );
}

const meta = {
    title: 'packages/ui/Public Chrome/Public Environment',
    component: PublicEnvironmentPreview,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Time-of-day sky used behind the public www and News surfaces. The preview includes astronomical sun/moon placement, moon phase, weather tone, and the contrast veil.',
            },
        },
    },
    argTypes: {
        hour: {
            control: { min: 0, max: 23, step: 1, type: 'range' },
        },
        weatherKind: {
            control: 'select',
            options: ['clear', 'cloudy', 'rain', 'snow', 'fog', 'storm'],
        },
    },
    args: {
        hour: 20,
        weatherKind: 'clear',
    },
} satisfies Meta<typeof PublicEnvironmentPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Dusk: Story = {};

export const RainyDay: Story = {
    args: { hour: 13, weatherKind: 'rain' },
};

export const SnowyMorning: Story = {
    args: { hour: 8, weatherKind: 'snow' },
};

export const ClearNight: Story = {
    args: { hour: 23, weatherKind: 'clear' },
};
