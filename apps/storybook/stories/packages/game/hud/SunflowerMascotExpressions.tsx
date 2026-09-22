import { SunflowerMascot3D } from '@gredice/ui/SunflowerVisuals';

export function SunflowerMascotExpressions() {
    return (
        <section aria-label="Izrazi maskote" className="space-y-4">
            <h2 className="text-xl font-semibold">Maskota · 3D prikaz</h2>
            <div className="flex flex-wrap items-end gap-8">
                <figure className="space-y-2">
                    <SunflowerMascot3D className="size-36" aria-hidden />
                    <figcaption>Suncokreti i nagrade</figcaption>
                </figure>
                <figure className="space-y-2">
                    <SunflowerMascot3D
                        expression="sad"
                        className="size-36"
                        aria-hidden
                    />
                    <figcaption>Greške i prazna stanja</figcaption>
                </figure>
                <figure className="space-y-2">
                    <SunflowerMascot3D
                        expression="gift"
                        className="size-36"
                        aria-hidden
                    />
                    <figcaption>Preporuke i pokloni</figcaption>
                </figure>
            </div>
        </section>
    );
}
