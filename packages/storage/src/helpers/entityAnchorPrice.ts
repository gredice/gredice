import type { AnchorPrice } from '@gredice/js/pricing';

type Revision = {
    action: string;
    previousValue: string | null;
    nextValue: string | null;
    previousState: string | null;
    nextState: string | null;
    createdAt: Date;
};

function price(value: string | null) {
    if (value === null || value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** Both statutory reference dates fall in Zagreb summer time (UTC+02). */
export function anchorDateCutoff(date: string) {
    if (date !== '2026-09-10' && date !== '2025-05-02') {
        throw new Error('Unsupported anchor price reference date');
    }
    return new Date(new Date(`${date}T00:00:00+02:00`).getTime() + 86_400_000);
}

/** Revisions must be ordered by createdAt DESC, id DESC. Never infer a
 * historical price from a current value that has no dated evidence. */
export function resolveEntityAnchorPrice({
    date,
    now,
    entity,
    value,
    revisions,
}: {
    date: string;
    now: Date;
    entity: {
        createdAt: Date;
        updatedAt?: Date;
        publishedAt: Date | null;
        state: string;
    };
    value:
        | { value: string | null; createdAt: Date; updatedAt: Date }
        | undefined;
    revisions: ReadonlyArray<Revision>;
}): AnchorPrice | null {
    const cutoff = anchorDateCutoff(date);
    if (now < cutoff || entity.createdAt >= cutoff) return null;

    const stateRevisions = revisions.filter(
        (revision) =>
            ['entity.state_changed', 'entity.updated'].includes(
                revision.action,
            ) &&
            revision.previousState !== null &&
            revision.nextState !== null,
    );
    const stateBefore = stateRevisions.find((r) => r.createdAt < cutoff);
    const stateAfter = stateRevisions
        .filter((r) => r.createdAt >= cutoff)
        .at(-1);
    const state = stateAfter
        ? stateAfter.previousState
        : stateBefore
          ? stateBefore.nextState
          : (entity.publishedAt && entity.publishedAt < cutoff) ||
              (entity.publishedAt === null &&
                  entity.updatedAt &&
                  entity.updatedAt < cutoff)
            ? entity.state
            : null;
    if (state !== 'published') return null;

    const priceRevisions = revisions.filter((revision) =>
        [
            'attribute.created',
            'attribute.updated',
            'attribute.deleted',
        ].includes(revision.action),
    );
    const after = priceRevisions.filter((r) => r.createdAt >= cutoff).at(-1);
    const before = priceRevisions.find((r) => r.createdAt < cutoff);
    const amount = after
        ? price(after.previousValue)
        : before
          ? price(before.nextValue)
          : value && value.createdAt < cutoff && value.updatedAt < cutoff
            ? price(value.value)
            : null;
    return amount === null ? null : { price: amount, date };
}
