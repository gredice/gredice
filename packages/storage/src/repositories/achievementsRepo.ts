import 'server-only';
import {
    type AchievementDefinition,
    getAchievementDefinition,
    getAchievementDefinitions,
} from '@gredice/js/achievements';
import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm';
import {
    type AccountSunflowersPayload,
    accountAchievements,
    accounts,
    accountUsers,
    communityEditRequests,
    type EntityStandardized,
    earnSunflowers,
    events,
    knownEventTypes,
    operations,
    raisedBeds,
    type SelectAccountAchievement,
    storage,
} from '..';
import { getEntitiesFormatted } from './entitiesRepo';
import type { RaisedBedFieldPlantEventsPayload } from './events/types';

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

export async function getPendingAchievementsCount() {
    const result = await storage()
        .select({ count: sql<number>`count(*)` })
        .from(accountAchievements)
        .where(eq(accountAchievements.status, 'pending'));
    return result[0]?.count ?? 0;
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

interface CommunityEditAchievementSource {
    requestId: number;
    accountId: string;
    earnedAt: Date;
}

function addThresholdPlans(input: {
    plans: AchievementPlan[];
    existingByAccount: Map<string, Set<string>>;
    plannedByAccount: Map<string, Set<string>>;
    accountId: string;
    count: number;
    earnedAt: Date;
    definitions: AchievementDefinition[];
}) {
    const existing = input.existingByAccount.get(input.accountId) ?? new Set();
    const planned = ensureAccountSet(input.plannedByAccount, input.accountId);
    for (const definition of input.definitions) {
        const threshold = definition.threshold ?? 0;
        if (
            input.count >= threshold &&
            !existing.has(definition.key) &&
            !planned.has(definition.key)
        ) {
            input.plans.push({
                accountId: input.accountId,
                definition,
                earnedAt: input.earnedAt,
                progressValue: input.count,
            });
            planned.add(definition.key);
        }
    }
}

function addCommunityEditAchievementPlans(input: {
    sources: CommunityEditAchievementSource[];
    definitions: AchievementDefinition[];
    existingByAccount: Map<string, Set<string>>;
    plannedByAccount: Map<string, Set<string>>;
    plans: AchievementPlan[];
}) {
    const counters = new Map<string, number>();
    const seenRequestIds = new Set<number>();
    for (const source of input.sources) {
        if (seenRequestIds.has(source.requestId)) {
            continue;
        }
        seenRequestIds.add(source.requestId);

        const nextCount = (counters.get(source.accountId) ?? 0) + 1;
        counters.set(source.accountId, nextCount);
        addThresholdPlans({
            plans: input.plans,
            existingByAccount: input.existingByAccount,
            plannedByAccount: input.plannedByAccount,
            accountId: source.accountId,
            count: nextCount,
            earnedAt: source.earnedAt,
            definitions: input.definitions,
        });
    }
}

async function createPlannedAchievements(
    plans: AchievementPlan[],
    existingByAccount: Map<string, Set<string>>,
) {
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

export async function evaluateCommunityEditAchievementsForSubmitter(
    userId: string,
) {
    const [primaryAccountUser] = await storage()
        .select({ accountId: accountUsers.accountId })
        .from(accountUsers)
        .where(eq(accountUsers.userId, userId))
        .orderBy(asc(accountUsers.createdAt), asc(accountUsers.id))
        .limit(1);

    if (!primaryAccountUser) {
        return { created: 0, attempts: 0 };
    }

    const [existingAchievements, appliedRequests] = await Promise.all([
        storage()
            .select({ achievementKey: accountAchievements.achievementKey })
            .from(accountAchievements)
            .where(
                eq(accountAchievements.accountId, primaryAccountUser.accountId),
            ),
        storage()
            .select({
                requestId: communityEditRequests.id,
                appliedAt: communityEditRequests.appliedAt,
                reviewedAt: communityEditRequests.reviewedAt,
                createdAt: communityEditRequests.createdAt,
            })
            .from(communityEditRequests)
            .where(
                and(
                    eq(communityEditRequests.submitterUserId, userId),
                    eq(communityEditRequests.status, 'applied'),
                ),
            )
            .orderBy(
                asc(communityEditRequests.appliedAt),
                asc(communityEditRequests.id),
            ),
    ]);

    const existingByAccount = new Map<string, Set<string>>();
    const existingKeys = ensureAccountSet(
        existingByAccount,
        primaryAccountUser.accountId,
    );
    for (const achievement of existingAchievements) {
        existingKeys.add(achievement.achievementKey);
    }

    const plans: AchievementPlan[] = [];
    addCommunityEditAchievementPlans({
        sources: appliedRequests.map((request) => ({
            requestId: request.requestId,
            accountId: primaryAccountUser.accountId,
            earnedAt:
                request.appliedAt ?? request.reviewedAt ?? request.createdAt,
        })),
        definitions: getDefinitionsByCategory('community_editing'),
        existingByAccount,
        plannedByAccount: new Map(),
        plans,
    });

    return createPlannedAchievements(plans, existingByAccount);
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

    if (name?.includes('watter') || name?.includes('water')) {
        return true;
    }

    return false;
}

// TODO: Add an attribute to the operation entity that determines whether the operation is a harvest operation
// instead of relying on name/label/stage matching
function isHarvestOperation(entity: EntityStandardized | null | undefined) {
    if (!entity) return false;

    // Check the main information for harvest-related terms
    const name = entity.information?.name?.toLowerCase();

    // Check for specific harvest operation names
    if (
        name === 'harvestplant' ||
        name === 'harvestall' ||
        name === 'harvestmature' ||
        name === 'harvest50mature' ||
        name === 'harvest25mature'
    ) {
        return true;
    }

    return false;
}

export async function evaluateAchievements() {
    const [
        accountsList,
        existingAchievements,
        raisedBedList,
        operationsList,
        communityEditAchievementRows,
    ] = await Promise.all([
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
        storage()
            .select({
                requestId: communityEditRequests.id,
                accountId: accountUsers.accountId,
                appliedAt: communityEditRequests.appliedAt,
                reviewedAt: communityEditRequests.reviewedAt,
                createdAt: communityEditRequests.createdAt,
            })
            .from(communityEditRequests)
            .innerJoin(
                accountUsers,
                eq(accountUsers.userId, communityEditRequests.submitterUserId),
            )
            .where(eq(communityEditRequests.status, 'applied'))
            .orderBy(
                asc(communityEditRequests.appliedAt),
                asc(communityEditRequests.id),
                asc(accountUsers.createdAt),
                asc(accountUsers.id),
            ),
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
    const communityEditDefinitions =
        getDefinitionsByCategory('community_editing');

    const plantingCounters = new Map<string, number>();
    const harvestCounters = new Map<string, number>();
    const wateringCounters = new Map<string, number>();

    const plantEvents = await storage().query.events.findMany({
        where: eq(events.type, knownEventTypes.raisedBedFields.plantUpdate),
        orderBy: [asc(events.createdAt)],
    });

    for (const event of plantEvents) {
        const data = event.data as RaisedBedFieldPlantEventsPayload | undefined;
        const status =
            data && 'status' in data ? data?.status?.toLowerCase() : undefined;
        if (status !== 'sowed') {
            continue;
        }
        const raisedBedId = parseRaisedBedId(event.aggregateId);
        if (!raisedBedId) continue;
        const accountId = raisedBedAccountMap.get(raisedBedId);
        if (!accountId) continue;

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
    }

    const operationEntities =
        (await getEntitiesFormatted<EntityStandardized>('operation')) ?? [];
    const wateringEntityIds = new Set<number>();
    const harvestEntityIds = new Set<number>();
    for (const entity of operationEntities) {
        const idValue = entity.id;
        if (typeof idValue !== 'number') continue;

        if (isWateringOperation(entity)) {
            wateringEntityIds.add(idValue);
        }
        if (isHarvestOperation(entity)) {
            harvestEntityIds.add(idValue);
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
        if (!info?.accountId) continue;

        // Track watering operations
        if (wateringEntityIds.has(info.entityId)) {
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

        // Track harvest operations
        if (harvestEntityIds.has(info.entityId)) {
            const nextCount = (harvestCounters.get(info.accountId) ?? 0) + 1;
            harvestCounters.set(info.accountId, nextCount);
            const existing = existingByAccount.get(info.accountId) ?? new Set();
            const planned = ensureAccountSet(plannedByAccount, info.accountId);
            for (const definition of harvestDefinitions) {
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
    }

    addCommunityEditAchievementPlans({
        sources: communityEditAchievementRows.map((row) => ({
            requestId: row.requestId,
            accountId: row.accountId,
            earnedAt: row.appliedAt ?? row.reviewedAt ?? row.createdAt,
        })),
        definitions: communityEditDefinitions,
        existingByAccount,
        plannedByAccount,
        plans,
    });

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
        const data = event.data as AccountSunflowersPayload | undefined;
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

    return createPlannedAchievements(plans, existingByAccount);
}
