import type { AutumnActivityState } from '@gredice/client';
import Image from 'next/image';

export function AutumnActivityReward({
    reward,
    title,
    claimed,
}: {
    reward: NonNullable<AutumnActivityState['campaign']>['rewards']['welcome'];
    title: string;
    claimed: boolean;
}) {
    const line = reward.snapshot.lines[0];
    if (!line) return null;
    const label =
        reward.snapshot.name.hr ??
        Object.values(reward.snapshot.name)[0] ??
        line.modelName;
    return (
        <section
            aria-label={title}
            className="flex items-center gap-3 rounded-lg bg-muted/50 p-3"
        >
            <Image
                src={`/assets/blocks/${line.modelName}.webp`}
                unoptimized
                alt=""
                width={64}
                height={64}
                className="size-16 object-contain"
            />
            <div>
                <h3 className="font-semibold">{title}</h3>
                <p>
                    {label} × {line.quantity}
                </p>
                <p className="text-sm text-muted-foreground">
                    {claimed
                        ? 'Spremljeno u tvoje pakete.'
                        : 'Bez naplate suncokreta.'}
                </p>
            </div>
        </section>
    );
}
