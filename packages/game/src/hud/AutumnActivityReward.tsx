import type { AutumnActivityState } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import Image from 'next/image';
import { useState } from 'react';

export function AutumnActivityReward({
    reward,
    title,
    claimed,
}: {
    reward: NonNullable<AutumnActivityState['campaign']>['rewards']['welcome'];
    title: string;
    claimed: boolean;
}) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
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
            {failedUrl !== reward.review.previewUrl ? (
                <Image
                    src={reward.review.previewUrl}
                    unoptimized
                    alt={`Prikaz: ${label}`}
                    width={64}
                    height={64}
                    className="size-16 object-contain"
                    onError={() => setFailedUrl(reward.review.previewUrl)}
                />
            ) : null}
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
                {failedUrl === reward.review.previewUrl && (
                    <div className="text-sm">
                        <p>Prikaz ukrasa nije učitan.</p>
                        <Button
                            size="sm"
                            variant="plain"
                            onClick={() => setFailedUrl(null)}
                        >
                            Ponovno učitaj prikaz
                        </Button>
                    </div>
                )}
            </div>
        </section>
    );
}
