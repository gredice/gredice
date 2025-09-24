import 'server-only';
import {
    type AchievementDefinition,
    getAchievementDefinition,
    getAchievementDefinitions,
} from '@gredice/js/achievements';
import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm';
import {
    accountAchievements,
    accounts,
    type EarnSunflowersEventData,
    type EntityStandardized,
    earnSunflowers,
    events,
    knownEventTypes,
    operations,
    type PlantUpdateEventData,
    raisedBeds,
    type SelectAccountAchievement,
    storage,
} from '..';
import { getEntitiesFormatted } from './entitiesRepo';

interface CreateAchievementOptions {
    earnedAt?: Date;
    progressValue?: number | null;
    threshold?: number | null;
    metadata?: Record<string, unknown> | null;
    status?: 'pending' | 'approved' | 'denied';
    autoApprove?: boolean;
    skipReward?: boolean;
    rewardSunflowersOverride?: number;
}

interface EnsureAchievementResult {
    created: boolean;
    achievement: SelectAccountAchievement;
}

export async function getAccountAchievements(accountId: string) {
    return storage().query.accountAchievements.findMany({
        where: eq(accountAchievements.accountId, accountId),
        orderBy: [desc(accountAchievements.earnedAt)],
    });
}

export async function getAchievements({
    status,
    limit,
    offset,
}: {
    status?: 'pending' | 'approved' | 'denied';
    limit?: number;
    offset?: number;
} = {}) {
    return storage().query.accountAchievements.findMany({
        where:
            status && status !== 'pending'
                ? eq(accountAchievements.status, status)
                : status === 'pending'
                  ? eq(accountAchievements.status, 'pending')
                  : undefined,
        limit,
        offset,
        orderBy: [desc(accountAchievements.createdAt)],
    });
}

function definitionForKey(key: string) {
    const definition = getAchievementDefinition(key);
    if (!definition) {
        throw new Error(`Unknown achievement key: ${key}`);
    }
    return definition;
}

async function createAccountAchievement(
    accountId: string,
    key: string,
    options: CreateAchievementOptions = {},
): Promise<EnsureAchievementResult> {
    const definition = definitionForKey(key);
    const status =
        options.status ??
        ((options.autoApprove ?? definition.autoApprove)
            ? 'approved'
            : 'pending');
    const earnedAt = options.earnedAt ?? new Date();
    const rewardSunflowers =
        options.rewardSunflowersOverride ?? definition.rewardSunflowers;
    const threshold = options.threshold ?? definition.threshold ?? null;
    const progressValue = options.progressValue ?? threshold ?? null;

    const insertResult = await storage()
        .insert(accountAchievements)
        .values({
            accountId,
            achievementKey: key,
            status,
            rewardSunflowers,
            threshold,
            progressValue,
            metadata: options.metadata ?? null,
            earnedAt,
            approvedAt: status === 'approved' ? earnedAt : null,
            createdAt: earnedAt,
        })
        .onConflictDoNothing({
            target: [
                accountAchievements.accountId,
                accountAchievements.achievementKey,
            ],
        })
        .returning();

    if (insertResult.length === 0) {
        const existing = await storage().query.accountAchievements.findFirst({
            where: and(
                eq(accountAchievements.accountId, accountId),
                eq(accountAchievements.achievementKey, key),
            ),
        });
        if (!existing) {
            throw new Error('Failed to create or retrieve achievement record.');
        }
        return { created: false, achievement: existing };
    }

    let achievement = insertResult[0];

    if (status === 'approved') {
        if (!options.skipReward && rewardSunflowers > 0) {
            await earnSunflowers(
                accountId,
                rewardSunflowers,
                `achievement:${key}`,
            );
            const [updated] = await storage()
                .update(accountAchievements)
                .set({
                    rewardGrantedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(accountAchievements.id, achievement.id))
                .returning();
            if (updated) achievement = updated;
        } else if (options.skipReward) {
            const [updated] = await storage()
                .update(accountAchievements)
                .set({
                    rewardGrantedAt: earnedAt,
                    updatedAt: new Date(),
                })
                .where(eq(accountAchievements.id, achievement.id))
                .returning();
            if (updated) achievement = updated;
        }
    }

    return { created: true, achievement };
}

export async function ensureAccountAchievement(
    accountId: string,
    key: string,
    options: CreateAchievementOptions = {},
) {
    return createAccountAchievement(accountId, key, options);
}

export async function approveAchievement(
    achievementId: number,
    adminUserId: string,
) {
    const existing = await storage().query.accountAchievements.findFirst({
        where: eq(accountAchievements.id, achievementId),
    });
    if (!existing) {
        throw new Error('Achievement not found');
    }
    if (existing.status === 'approved') {
        return existing;
    }

    const now = new Date();
    const [updated] = await storage()
        .update(accountAchievements)
        .set({
            status: 'approved',
            approvedAt: now,
            approvedByUserId: adminUserId,
            deniedAt: null,
            deniedByUserId: null,
            updatedAt: now,
        })
        .where(eq(accountAchievements.id, achievementId))
        .returning();

    if (!updated) {
        throw new Error('Failed to approve achievement');
    }

    if (!updated.rewardGrantedAt && updated.rewardSunflowers > 0) {
        await earnSunflowers(
            updated.accountId,
            updated.rewardSunflowers,
            `achievement:${updated.achievementKey}`,
        );
        const [withReward] = await storage()
            .update(accountAchievements)
            .set({
                rewardGrantedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(accountAchievements.id, achievementId))
            .returning();
        if (withReward) {
            return withReward;
        }
    }

    return updated;
}

export async function denyAchievement(
    achievementId: number,
    adminUserId: string,
) {
    const now = new Date();
    const [updated] = await storage()
        .update(accountAchievements)
        .set({
            status: 'denied',
            deniedAt: now,
            deniedByUserId: adminUserId,
            updatedAt: now,
        })
        .where(eq(accountAchievements.id, achievementId))
        .returning();

    if (!updated) {
        throw new Error('Failed to deny achievement');
    }

    return updated;
}

function getDefinitionsByCategory(category: AchievementDefinition['category']) {
    return getAchievementDefinitions()
        .filter((definition) => definition.category === category)
        .filter((definition) => typeof definition.threshold === 'number')
        .sort((a, b) => (a.threshold ?? 0) - (b.threshold ?? 0));
}

function ensureAccountSet(map: Map<string, Set<string>>, accountId: string) {
    let value = map.get(accountId);
    if (!value) {
        value = new Set();
        map.set(accountId, value);
    }
    return value;
}

interface AchievementPlan {
    accountId: string;
    definition: AchievementDefinition;
    earnedAt: Date;
    progressValue: number | null;
    skipReward?: boolean;
}

function parseRaisedBedId(aggregateId: string) {
    const [raisedBedPart] = aggregateId.split('|');
    const raisedBedId = Number.parseInt(raisedBedPart ?? '', 10);
    return Number.isNaN(raisedBedId) ? null : raisedBedId;
}

function isWateringOperation(entity: EntityStandardized | null | undefined) {
    if (!entity) return false;

    // Check the main information for watering-related terms
    const name = entity.information?.name?.toLowerCase();
    const label = entity.information?.label?.toLowerCase();

    if (name?.includes('watter') || name?.includes('water')) {
        return true;
    }

    if (label?.includes('zalije') || label?.includes('water')) {
        return true;
    }

    // Check the stage information for watering stage
    const stageName =
        entity.attributes?.stage?.information?.name?.toLowerCase();
    const stageLabel =
        entity.attributes?.stage?.information?.label?.toLowerCase();

    if (stageName === 'watering') return true;
    if (stageLabel?.includes('zalije')) return true;

    return false;
}

export async function evaluateAchievements() {
    const [accountsList, existingAchievements, raisedBedList, operationsList] =
        await Promise.all([
            storage()
                .select({ id: accounts.id, createdAt: accounts.createdAt })
                .from(accounts),
            storage()
                .select({
                    accountId: accountAchievements.accountId,
                    achievementKey: accountAchievements.achievementKey,
                })
                .from(accountAchievements),
            storage()
                .select({
                    id: raisedBeds.id,
                    accountId: raisedBeds.accountId,
                })
                .from(raisedBeds)
                .where(isNotNull(raisedBeds.accountId)),
            storage()
                .select({
                    id: operations.id,
                    accountId: operations.accountId,
                    entityId: operations.entityId,
                })
                .from(operations)
                .where(eq(operations.isDeleted, false)),
        ]);

    const existingByAccount = new Map<string, Set<string>>();
    for (const achievement of existingAchievements) {
        ensureAccountSet(existingByAccount, achievement.accountId).add(
            achievement.achievementKey,
        );
    }

    const raisedBedAccountMap = new Map<number, string>();
    for (const bed of raisedBedList) {
        if (bed.accountId) {
            raisedBedAccountMap.set(bed.id, bed.accountId);
        }
    }

    const operationAccountMap = new Map<
        number,
        { accountId: string | null; entityId: number }
    >();
    for (const operation of operationsList) {
        operationAccountMap.set(operation.id, {
            accountId: operation.accountId ?? null,
            entityId: operation.entityId,
        });
    }

    const plannedByAccount = new Map<string, Set<string>>();
    const plans: AchievementPlan[] = [];

    const plantingDefinitions = getDefinitionsByCategory('planting');
    const harvestDefinitions = getDefinitionsByCategory('harvest');
    const wateringDefinitions = getDefinitionsByCategory('watering');

    const plantingCounters = new Map<string, number>();
    const harvestCounters = new Map<string, number>();
    const wateringCounters = new Map<string, number>();

    const plantEvents = await storage().query.events.findMany({
        where: eq(events.type, knownEventTypes.raisedBedFields.plantUpdate),
        orderBy: [asc(events.createdAt)],
    });

    for (const event of plantEvents) {
        const data = event.data as PlantUpdateEventData | undefined;
        const status = data?.status?.toLowerCase();
        if (status !== 'sowed' && status !== 'harvested') {
            continue;
        }
        const raisedBedId = parseRaisedBedId(event.aggregateId);
        if (!raisedBedId) continue;
        const accountId = raisedBedAccountMap.get(raisedBedId);
        if (!accountId) continue;

        if (status === 'sowed') {
            const nextCount = (plantingCounters.get(accountId) ?? 0) + 1;
            plantingCounters.set(accountId, nextCount);
            const existing = existingByAccount.get(accountId) ?? new Set();
            const planned = ensureAccountSet(plannedByAccount, accountId);
            for (const definition of plantingDefinitions) {
                const threshold = definition.threshold ?? 0;
                if (
                    nextCount >= threshold &&
                    !existing.has(definition.key) &&
                    !planned.has(definition.key)
                ) {
                    plans.push({
                        accountId,
                        definition,
                        earnedAt: event.createdAt,
                        progressValue: nextCount,
                    });
                    planned.add(definition.key);
                }
            }
        } else if (status === 'harvested') {
            const nextCount = (harvestCounters.get(accountId) ?? 0) + 1;
            harvestCounters.set(accountId, nextCount);
            const existing = existingByAccount.get(accountId) ?? new Set();
            const planned = ensureAccountSet(plannedByAccount, accountId);
            for (const definition of harvestDefinitions) {
                const threshold = definition.threshold ?? 0;
                if (
                    nextCount >= threshold &&
                    !existing.has(definition.key) &&
                    !planned.has(definition.key)
                ) {
                    plans.push({
                        accountId,
                        definition,
                        earnedAt: event.createdAt,
                        progressValue: nextCount,
                    });
                    planned.add(definition.key);
                }
            }
        }
    }

    const operationEntities =
        (await getEntitiesFormatted<EntityStandardized>('operation')) ?? [];
    const wateringEntityIds = new Set<number>();
    for (const entity of operationEntities) {
        if (!isWateringOperation(entity)) {
            continue;
        }
        const idValue = entity.id;
        if (typeof idValue === 'number') {
            wateringEntityIds.add(idValue);
        }
    }

    const operationEvents = await storage().query.events.findMany({
        where: eq(events.type, knownEventTypes.operations.complete),
        orderBy: [asc(events.createdAt)],
    });

    for (const event of operationEvents) {
        const operationId = Number.parseInt(event.aggregateId, 10);
        if (Number.isNaN(operationId)) continue;
        const info = operationAccountMap.get(operationId);
        if (!info || !info.accountId) continue;
        if (!wateringEntityIds.has(info.entityId)) continue;

        const nextCount = (wateringCounters.get(info.accountId) ?? 0) + 1;
        wateringCounters.set(info.accountId, nextCount);
        const existing = existingByAccount.get(info.accountId) ?? new Set();
        const planned = ensureAccountSet(plannedByAccount, info.accountId);
        for (const definition of wateringDefinitions) {
            const threshold = definition.threshold ?? 0;
            if (
                nextCount >= threshold &&
                !existing.has(definition.key) &&
                !planned.has(definition.key)
            ) {
                plans.push({
                    accountId: info.accountId,
                    definition,
                    earnedAt: event.createdAt,
                    progressValue: nextCount,
                });
                planned.add(definition.key);
            }
        }
    }

    const registrationDefinition = definitionForKey('registration');
    const registrationEvents = await storage().query.events.findMany({
        where: and(
            eq(events.type, knownEventTypes.accounts.earnSunflowers),
            sql`${events.data} ->> 'reason' IN ('registration', 'achievement:registration')`,
        ),
        orderBy: [asc(events.createdAt)],
    });
    const registrationMap = new Map<string, Date>();
    for (const event of registrationEvents) {
        const data = event.data as EarnSunflowersEventData | undefined;
        const reason = data?.reason;
        const accountId = event.aggregateId;
        if (!accountId) continue;
        if (!registrationMap.has(accountId)) {
            registrationMap.set(accountId, event.createdAt);
        }
        if (reason === 'achievement:registration') {
            registrationMap.set(accountId, event.createdAt);
        }
    }

    for (const account of accountsList) {
        const existing = existingByAccount.get(account.id);
        const planned = plannedByAccount.get(account.id);
        if (existing?.has('registration') || planned?.has('registration')) {
            continue;
        }
        const earnedAt =
            registrationMap.get(account.id) ?? account.createdAt ?? new Date();
        const skipReward = registrationMap.has(account.id);
        plans.push({
            accountId: account.id,
            definition: registrationDefinition,
            earnedAt,
            progressValue: 1,
            skipReward,
        });
        ensureAccountSet(plannedByAccount, account.id).add('registration');
    }

    let created = 0;
    for (const plan of plans) {
        const result = await createAccountAchievement(
            plan.accountId,
            plan.definition.key,
            {
                earnedAt: plan.earnedAt,
                progressValue: plan.progressValue,
                threshold: plan.definition.threshold ?? null,
                skipReward: plan.skipReward,
            },
        );
        if (result.created) {
            created += 1;
            ensureAccountSet(existingByAccount, plan.accountId).add(
                plan.definition.key,
            );
        }
    }

    return { created, attempts: plans.length };
}
