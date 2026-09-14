import { GameRaisedBedIcon } from '@gredice/ui/GameIcons';
import Image from 'next/image';
import backpackReference from '../../../../garden/public/assets/hud/inventory-backpack.webp?url';
import basketReference from '../../../../garden/public/assets/hud/shopping-basket.webp?url';
import { GameIconGroups } from '../game/icons/GameIconGroups';
import { gameIconComparisons } from './gameIconComparisons';
import { PlantCareHudPreview } from './PlantCareHudPreview';

export function GameIconsShowcase({ dark = false }: { dark?: boolean }) {
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
                    <h1 className="text-xl font-semibold">Styled game icons</h1>
                    <p className="text-sm text-muted-foreground">
                        Rendered game artwork with chunky geometry, beveled
                        edges and shaded materials, using the existing backpack
                        and shopping basket as the style references.
                    </p>
                </header>
                <section
                    aria-label="Existing style references"
                    className="flex flex-wrap items-center gap-6 rounded-lg border bg-card p-4"
                >
                    <h2 className="text-sm font-semibold">
                        Existing style references
                    </h2>
                    <figure className="flex flex-col items-center gap-2">
                        <Image
                            src={backpackReference}
                            alt=""
                            width={80}
                            height={80}
                            className="size-20 object-contain"
                        />
                        <figcaption className="text-xs text-muted-foreground">
                            Backpack
                        </figcaption>
                    </figure>
                    <figure className="flex flex-col items-center gap-2">
                        <Image
                            src={basketReference}
                            alt=""
                            width={80}
                            height={80}
                            className="size-20 object-contain"
                        />
                        <figcaption className="text-xs text-muted-foreground">
                            Shopping basket
                        </figcaption>
                    </figure>
                </section>
                <GameIconGroups />
                <PlantCareHudPreview />
                <div className="space-y-3">
                    {gameIconComparisons.map(
                        ({ name, before: Before, after: After, usage }) => (
                            <section
                                key={name}
                                aria-label={name}
                                className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4"
                            >
                                <div className="w-36">
                                    <h2 className="text-sm font-semibold">
                                        {name}
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        {usage}
                                    </p>
                                </div>
                                <figure className="flex w-12 flex-col items-center gap-2">
                                    <Before className="size-6" />
                                    <figcaption className="text-xs text-muted-foreground">
                                        Before
                                    </figcaption>
                                </figure>
                                <div className="flex flex-wrap items-end gap-5">
                                    {[16, 20, 24, 32, 48, 64].map((size) => (
                                        <figure
                                            key={size}
                                            className="flex flex-col items-center gap-2"
                                        >
                                            <After width={size} height={size} />
                                            <figcaption className="text-xs text-muted-foreground">
                                                {size}px
                                            </figcaption>
                                        </figure>
                                    ))}
                                </div>
                            </section>
                        ),
                    )}
                </div>
                <section
                    className="space-y-4"
                    aria-label="Physical identifiers"
                >
                    <h2 className="text-lg font-semibold">
                        Physical identifiers
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Identifiers remain text above the bed, on a contrasting
                        backing. The wrapper reserves the full label width even
                        inside the 24px operation-row layout.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {[0, 7, 'A12', '1234', 'ZG-12345', null, ''].map(
                            (physicalId) => (
                                <div
                                    key={String(physicalId)}
                                    data-bed-example={String(physicalId)}
                                    className="flex min-w-0 items-center gap-2 rounded-md border bg-card p-4"
                                >
                                    <GameRaisedBedIcon
                                        physicalId={physicalId}
                                        containerClassName="h-6 w-6 min-w-6 overflow-visible"
                                        className="size-5"
                                    />
                                    <span className="text-sm">
                                        {physicalId == null || physicalId === ''
                                            ? 'Bed without an identifier'
                                            : `Bed ${physicalId}`}
                                    </span>
                                </div>
                            ),
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
