import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Markdown } from '@gredice/ui/Markdown';
import { PageHeader } from '@gredice/ui/PageHeader';
import {
    type PublicEnvironmentWeatherKind,
    PublicFooterLandscape,
    PublicSkyBackdrop,
    publicEnvironmentWeatherPresets,
    resolvePublicEnvironmentDateAtMinutes,
    resolvePublicEnvironmentSnapshot,
} from '@gredice/ui/PublicChrome';
import { Typography } from '@gredice/ui/Typography';

type PublicEnvironmentPreviewProps = {
    hour: number;
    weatherKind: Exclude<PublicEnvironmentWeatherKind, 'live'>;
};

export function PublicEnvironmentPreview({
    hour,
    weatherKind,
}: PublicEnvironmentPreviewProps) {
    const date = resolvePublicEnvironmentDateAtMinutes(
        new Date('2026-08-24T12:00:00Z'),
        Math.round(hour * 60),
    );
    const weather = publicEnvironmentWeatherPresets[weatherKind];
    const snapshot = resolvePublicEnvironmentSnapshot({ date, weather });

    return (
        <div
            data-public-environment="on"
            className={`relative isolate min-h-[36rem] w-[min(72rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border text-foreground ${snapshot.dark ? 'dark' : ''}`}
        >
            <PublicSkyBackdrop
                position="absolute"
                snapshot={snapshot}
                weather={weather}
            />
            <div className="grid min-h-[20rem] content-between gap-12 p-6 sm:p-10">
                <div className="max-w-xl space-y-4">
                    <Breadcrumbs
                        items={[
                            { label: 'Biljke', href: '/biljke' },
                            { label: 'Bamija' },
                        ]}
                    />
                    <PageHeader
                        header="Bamija"
                        alternativeName="lat. Abelmoschus esculentus"
                        subHeader="Bamija je jednogodišnja povrtna biljka koju uzgajamo zbog jestivih mladih mahuna. Biljka voli toplo i sunčano mjesto."
                    />
                    <Markdown>
                        {
                            '## Priprema tla\n\nOdaberi **dobro drenirano tlo** bogato humusom.\n\n- Ukloni korov prije sadnje.\n- Redovito zalijevaj tijekom rasta.'
                        }
                    </Markdown>
                    <Typography level="body3">Nema dodatnih radnji</Typography>
                </div>
                <div className="justify-self-end rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm tabular-nums shadow-sm backdrop-blur-xl">
                    {Math.floor(hour).toString().padStart(2, '0')}:
                    {Math.round((hour % 1) * 60)
                        .toString()
                        .padStart(2, '0')}{' '}
                    · {weatherKind}
                </div>
            </div>
            <PublicFooterLandscape phase={snapshot.phase} />
        </div>
    );
}
