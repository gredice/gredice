import { getGrowingSeasonForDate, seasonAchievementKey } from './seasons';

export type GardenAchievementCommand =
    | {
          kind: 'start';
          cycleId: string;
          accountId: string;
          plantSortId?: number;
          at: Date;
      }
    | {
          kind: 'setSort';
          cycleId: string;
          plantSortId: number;
          at: Date;
      }
    | {
          kind: 'sow';
          cycleId: string;
          at: Date;
      }
    | {
          kind: 'harvest';
          cycleId: string;
          at: Date;
      };

type CycleState = {
    accountId: string;
    plantSortId?: number;
    sowedAt?: Date;
    harvestedAt?: Date;
};

export type AccountGardenAchievementProgress = {
    distinctPlants: Array<{ plantId: number; at: Date }>;
    completedCycles: Array<{ cycleId: string; at: Date }>;
    seasons: Map<string, Date>;
};

function compareByDateThenId(
    left: { at: Date; id: string },
    right: { at: Date; id: string },
) {
    const timeDiff = left.at.getTime() - right.at.getTime();
    if (timeDiff !== 0) return timeDiff;
    return left.id.localeCompare(right.id);
}

function addSeasonActivity(seasons: Map<string, Date>, at: Date) {
    const season = getGrowingSeasonForDate(at);
    if (!season) return;
    const key = seasonAchievementKey(season);
    const existing = seasons.get(key);
    if (!existing || at.getTime() < existing.getTime()) {
        seasons.set(key, at);
    }
}

/** Count distinct parent plants, completed sow-to-harvest cycles, and seasons. */
export function evaluateGardenAchievementProgress(
    commands: readonly GardenAchievementCommand[],
    plantIdBySortId: ReadonlyMap<number, number>,
) {
    const cycles = new Map<string, CycleState>();
    for (const command of commands) {
        if (command.kind === 'start') {
            const existing = cycles.get(command.cycleId);
            if (existing) {
                if (command.plantSortId !== undefined) {
                    existing.plantSortId = command.plantSortId;
                }
                continue;
            }
            cycles.set(command.cycleId, {
                accountId: command.accountId,
                plantSortId: command.plantSortId,
            });
            continue;
        }

        const cycle = cycles.get(command.cycleId);
        if (!cycle) continue;

        if (command.kind === 'setSort') {
            cycle.plantSortId = command.plantSortId;
            continue;
        }
        if (command.kind === 'sow') {
            cycle.sowedAt ??= command.at;
            continue;
        }
        if (command.kind === 'harvest' && cycle.sowedAt && !cycle.harvestedAt) {
            cycle.harvestedAt = command.at;
        }
    }

    const byAccount = new Map<string, AccountGardenAchievementProgress>();
    function accountProgress(accountId: string) {
        let progress = byAccount.get(accountId);
        if (!progress) {
            progress = {
                distinctPlants: [],
                completedCycles: [],
                seasons: new Map(),
            };
            byAccount.set(accountId, progress);
        }
        return progress;
    }

    const sowedCycles = [...cycles.entries()]
        .filter(
            (entry): entry is [string, CycleState & { sowedAt: Date }] =>
                entry[1].sowedAt instanceof Date,
        )
        .map(([cycleId, cycle]) => ({
            cycleId,
            accountId: cycle.accountId,
            plantSortId: cycle.plantSortId,
            sowedAt: cycle.sowedAt,
            harvestedAt: cycle.harvestedAt,
        }))
        .sort((left, right) =>
            compareByDateThenId(
                { at: left.sowedAt, id: left.cycleId },
                { at: right.sowedAt, id: right.cycleId },
            ),
        );

    const seenPlants = new Map<string, Set<number>>();
    for (const cycle of sowedCycles) {
        const progress = accountProgress(cycle.accountId);
        addSeasonActivity(progress.seasons, cycle.sowedAt);
        if (cycle.plantSortId === undefined) continue;
        const plantId = plantIdBySortId.get(cycle.plantSortId);
        if (plantId === undefined) continue;
        let seen = seenPlants.get(cycle.accountId);
        if (!seen) {
            seen = new Set();
            seenPlants.set(cycle.accountId, seen);
        }
        if (seen.has(plantId)) continue;
        seen.add(plantId);
        progress.distinctPlants.push({ plantId, at: cycle.sowedAt });
    }

    const harvestedCycles = sowedCycles
        .filter(
            (
                cycle,
            ): cycle is (typeof sowedCycles)[number] & { harvestedAt: Date } =>
                cycle.harvestedAt instanceof Date,
        )
        .map((cycle) => ({
            cycleId: cycle.cycleId,
            accountId: cycle.accountId,
            at: cycle.harvestedAt,
        }))
        .sort((left, right) =>
            compareByDateThenId(
                { at: left.at, id: left.cycleId },
                { at: right.at, id: right.cycleId },
            ),
        );

    for (const cycle of harvestedCycles) {
        const progress = accountProgress(cycle.accountId);
        progress.completedCycles.push({
            cycleId: cycle.cycleId,
            at: cycle.at,
        });
        addSeasonActivity(progress.seasons, cycle.at);
    }

    return byAccount;
}

export function thresholdReachedAt(
    items: ReadonlyArray<{ at: Date }>,
    threshold: number,
) {
    if (threshold < 1 || items.length < threshold) return undefined;
    return items[threshold - 1]?.at;
}
