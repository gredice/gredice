import { Button } from '@gredice/ui/Button';
import { GameLeafIcon } from '@gredice/ui/GameIcons';
import { IconButton } from '@gredice/ui/IconButton';
import { Check } from '@gredice/ui/icons';
import { useState } from 'react';
import { useAutumnActivity } from '../hooks/useAutumnActivity';
import { useAutumnActivityAction } from '../hooks/useAutumnActivityAction';
import { GameModal } from '../shared-ui/game-modal';
import { useBackpackOpenParam, useBackpackTabParam } from '../useUrlState';
import { AutumnActivityMotifIcon } from './AutumnActivityMotifIcon';
import { AutumnActivityReward } from './AutumnActivityReward';

export function AutumnActivityHud() {
    const [open, setOpen] = useState(false);
    const activity = useAutumnActivity();
    const action = useAutumnActivityAction(activity);
    const [, setInventoryOpen] = useBackpackOpenParam();
    const [, setInventoryTab] = useBackpackTabParam();
    const campaign = activity.data?.campaign;
    const progress = activity.data?.progress;
    const pending = action.isPending || Boolean(action.recovery?.uncertain);
    if (
        !activity.context.eligible ||
        (activity.data &&
            !campaign &&
            !activity.data.enabled &&
            !action.recovery?.command)
    )
        return null;
    return (
        <GameModal
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (next) void activity.refetch();
            }}
            title="Jesenski album"
            hudLayer
            trigger={
                <IconButton
                    title="Jesenski album"
                    aria-label="Jesenski album"
                    variant="plain"
                    className="size-10"
                >
                    <GameLeafIcon className="size-8" />
                </IconButton>
            }
        >
            <div
                className="min-w-0 space-y-4"
                aria-busy={activity.isFetching || action.isPending}
            >
                {activity.isPending && (
                    <p role="status">Učitavanje jesenskog albuma…</p>
                )}
                {activity.isError && (
                    <div role="alert" className="space-y-2">
                        <p>Jesenski album trenutačno nije moguće učitati.</p>
                        <Button onClick={() => void activity.refetch()}>
                            Pokušaj ponovno
                        </Button>
                    </div>
                )}
                {campaign && (
                    <>
                        <h2 className="font-semibold">{campaign.name}</h2>
                        <ul className="list-disc space-y-1 pl-5 text-sm">
                            {campaign.rules.map((rule) => (
                                <li key={rule}>{rule}</li>
                            ))}
                        </ul>
                        <p className="text-sm text-muted-foreground">
                            Dobiveni ukrasi ostaju tvoji i nakon završetka
                            aktivnosti. Povrat i recikliranje ovih darova ne
                            donose suncokrete.
                        </p>
                        <AutumnActivityReward
                            reward={campaign.rewards.welcome}
                            title="Ukras dobrodošlice"
                            claimed={Boolean(progress?.welcomePurchaseId)}
                        />
                        <AutumnActivityReward
                            reward={campaign.rewards.completion}
                            title="Uspomena za cijeli album"
                            claimed={Boolean(progress?.completionPurchaseId)}
                        />
                        <p className="text-sm">
                            Razdoblje prikupljanja:{' '}
                            {new Date(campaign.startsAt).toLocaleString(
                                'hr-HR',
                            )}{' '}
                            –{' '}
                            {new Date(campaign.endsAt).toLocaleString('hr-HR')}
                        </p>
                        {!activity.data?.actionAvailable && (
                            <p
                                role="status"
                                className="text-sm text-muted-foreground"
                            >
                                {activity.data?.eventStatus === 'upcoming'
                                    ? 'Prikupljanje još nije počelo.'
                                    : activity.data?.eventStatus === 'ended'
                                      ? 'Prikupljanje je završilo. Tvoj album i dobiveni ukrasi ostaju spremljeni.'
                                      : 'Prikupljanje trenutačno nije dostupno. Pokušaj ponovno kasnije.'}
                            </p>
                        )}
                        <Button
                            disabled={
                                !activity.data?.actionAvailable ||
                                pending ||
                                Boolean(progress?.welcomePurchaseId)
                            }
                            onClick={() =>
                                void action.submit({ kind: 'claim-welcome' })
                            }
                        >
                            {progress?.welcomePurchaseId
                                ? 'Ukras dobrodošlice preuzet'
                                : 'Preuzmi ukras dobrodošlice'}
                        </Button>
                        <p
                            role="status"
                            aria-live="polite"
                            className="font-medium"
                        >
                            {progress?.completed
                                ? 'Svih šest motiva je spremljeno. Uspomena je u tvojim paketima.'
                                : `Prikupljeno ${progress?.discoveredMotifIds.length ?? 0} od ${campaign.motifs.length} motiva`}
                        </p>
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                            {campaign.motifs.map((motif, index) => {
                                const collected =
                                    progress?.discoveredMotifIds.includes(
                                        motif.id,
                                    );
                                return (
                                    <Button
                                        key={motif.id}
                                        variant="plain"
                                        disabled={
                                            collected ||
                                            pending ||
                                            !activity.data?.actionAvailable
                                        }
                                        onClick={() =>
                                            void action.submit({
                                                kind: 'discover',
                                                motifId: motif.id,
                                            })
                                        }
                                        className="min-h-28 h-auto flex-col gap-2 rounded-lg border bg-muted/30 p-3 whitespace-normal"
                                    >
                                        <span
                                            aria-hidden
                                            className="flex items-center gap-2 text-amber-700"
                                        >
                                            <span>{index + 1}</span>
                                            {collected ? (
                                                <Check className="size-6" />
                                            ) : (
                                                <AutumnActivityMotifIcon
                                                    kind={motif.kind}
                                                />
                                            )}
                                        </span>
                                        <span>{motif.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {collected
                                                ? 'Spremljeno'
                                                : 'Prikupi motiv'}
                                        </span>
                                    </Button>
                                );
                            })}
                        </div>
                        {!activity.data?.actionAvailable && (
                            <Button
                                variant="plain"
                                onClick={() => void activity.refetch()}
                            >
                                Osvježi album
                            </Button>
                        )}
                        {(progress?.welcomePurchaseId ||
                            progress?.completionPurchaseId) && (
                            <Button
                                variant="plain"
                                onClick={() => {
                                    setOpen(false);
                                    void setInventoryTab('gardenPacks');
                                    void setInventoryOpen(true);
                                }}
                            >
                                Otvori moje pakete
                            </Button>
                        )}
                    </>
                )}
                {action.recovery?.error && (
                    <div role="alert" className="space-y-2">
                        <p>{action.recovery.error}</p>
                        {action.recovery.uncertain && (
                            <Button
                                disabled={action.isPending}
                                onClick={() => void action.submit()}
                            >
                                Provjeri isti zahtjev
                            </Button>
                        )}
                    </div>
                )}
                {action.isPending && <p role="status">Spremanje aktivnosti…</p>}
            </div>
        </GameModal>
    );
}
