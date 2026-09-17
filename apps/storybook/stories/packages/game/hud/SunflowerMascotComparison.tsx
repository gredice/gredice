import { SunflowerMascot3D } from '@gredice/ui/SunflowerVisuals';
import previousMascot from '../../../../../../packages/ui/src/GameIcons/assets/sunflower.svg';
import { GameIconFrame } from '../../../../../../packages/ui/src/GameIcons/GameIconFrame';

export function SunflowerMascotComparison() {
    return (
        <section aria-label="Usporedba maskote" className="space-y-4">
            <h2 className="text-xl font-semibold">Maskota · 3D prikaz</h2>
            <div className="flex flex-wrap items-end gap-8 rounded-xl border bg-card p-4">
                <figure className="space-y-2">
                    <GameIconFrame
                        source={previousMascot}
                        className="size-36"
                        aria-hidden
                    />
                    <figcaption>Prethodno</figcaption>
                </figure>
                <figure className="space-y-2">
                    <SunflowerMascot3D className="size-36" aria-hidden />
                    <figcaption>3D prikaz</figcaption>
                </figure>
                {[24, 40, 64].map((size) => (
                    <figure key={size} className="space-y-2">
                        <SunflowerMascot3D
                            width={size}
                            height={size}
                            aria-hidden
                        />
                        <figcaption>{size}px</figcaption>
                    </figure>
                ))}
            </div>
        </section>
    );
}
