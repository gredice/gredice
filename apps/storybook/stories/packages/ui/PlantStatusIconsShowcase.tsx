import {
    plantFieldStatusEmoji,
    plantFieldStatusLabel,
} from '@gredice/js/plants';
import { GamePlantStatusIcon } from '@gredice/ui/GameIcons';
import { PlantCareHudPreview } from './PlantCareHudPreview';
import { plantStatusIconExamples } from './plantStatusIconExamples';

export function PlantStatusIconsShowcase({ dark = false }: { dark?: boolean }) {
    return (
        <div
            className={
                dark
                    ? 'dark bg-background text-foreground'
                    : 'bg-background text-foreground'
            }
        >
            <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
                <header className="space-y-2">
                    <h1 className="text-xl font-semibold">
                        Plant status & care icons
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        The full lifecycle, from sowing to removal. Shared
                        artwork and small overlays keep related states
                        consistent.
                    </p>
                </header>
                <PlantCareHudPreview />
                <div className="grid gap-3 sm:grid-cols-2">
                    {plantStatusIconExamples.map(({ status, idea }) => (
                        <section
                            key={status}
                            data-status-example={status}
                            aria-label={`${plantFieldStatusLabel(status).shortLabel} · ${status}`}
                            className="space-y-3 rounded-lg border bg-card p-4"
                        >
                            <div className="flex items-center gap-3">
                                <GamePlantStatusIcon
                                    status={status}
                                    width={64}
                                    height={64}
                                />
                                <div>
                                    <h2 className="text-sm font-semibold">
                                        {
                                            plantFieldStatusLabel(status)
                                                .shortLabel
                                        }
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        {idea}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-end gap-4">
                                <figure className="flex flex-col items-center gap-1">
                                    <span className="text-xl" aria-hidden>
                                        {plantFieldStatusEmoji(status)}
                                    </span>
                                    <figcaption className="text-xs text-muted-foreground">
                                        Before
                                    </figcaption>
                                </figure>
                                {[20, 24, 28, 40].map((size) => (
                                    <figure
                                        key={size}
                                        className="flex flex-col items-center gap-1"
                                    >
                                        <GamePlantStatusIcon
                                            status={status}
                                            width={size}
                                            height={size}
                                            aria-hidden
                                        />
                                        <figcaption className="text-xs text-muted-foreground">
                                            {size}px
                                        </figcaption>
                                    </figure>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}
