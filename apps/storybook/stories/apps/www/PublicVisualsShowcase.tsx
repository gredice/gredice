import { cx } from '@gredice/ui/utils';
import { PublicVisualExamples } from './PublicVisualExamples';
import { publicVisualIcons } from './publicVisualIcons';

export function PublicVisualsShowcase({ dark = false }: { dark?: boolean }) {
    return (
        <div
            className={cx(
                'min-h-screen bg-background text-foreground',
                dark && 'dark',
            )}
        >
            <main className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6">
                <header className="space-y-2">
                    <h1 className="text-2xl font-semibold">
                        Public website artwork
                    </h1>
                    <p className="max-w-3xl text-secondary-foreground">
                        Shared 3D geometry and lighting with object-specific
                        colors: coral, blue, green, terracotta and cream.
                        Friendly text emojis remain part of the copy.
                    </p>
                </header>
                <PublicVisualExamples />
                <section
                    aria-label="Shared public icon inventory"
                    className="space-y-3"
                >
                    <h2 className="text-xl font-semibold">
                        Shared icons · 24–96px
                    </h2>
                    {publicVisualIcons.map(({ name, Icon, usage }) => (
                        <div
                            key={name}
                            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4"
                        >
                            <div className="w-56 space-y-1">
                                <h3 className="text-sm font-medium">{name}</h3>
                                <p className="text-xs text-secondary-foreground">
                                    {usage}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-end gap-5">
                                {[24, 32, 48, 96].map((size) => (
                                    <figure
                                        key={size}
                                        className="flex flex-col items-center gap-2"
                                    >
                                        <Icon
                                            aria-hidden
                                            width={size}
                                            height={size}
                                        />
                                        <figcaption className="text-xs text-secondary-foreground">
                                            {size}px
                                        </figcaption>
                                    </figure>
                                ))}
                            </div>
                        </div>
                    ))}
                </section>
            </main>
        </div>
    );
}
