import 'server-only';

import { and, eq } from 'drizzle-orm';
import {
    tutorialChecklistTaskClaims,
    userNotificationSettings,
} from '../schema';
import { storage } from '../storage';
import { getAccountInvitations } from './accountInvitationsRepo';
import {
    earnSunflowers,
    getAccountUsers,
    getSunflowersHistory,
} from './accountsRepo';
import { getAccountAchievements } from './achievementsRepo';
import { getDeliveryAddresses } from './deliveryAddressesRepo';
import { createEvent, getEvents, knownEventTypes } from './eventsRepo';
import { getAccountGardens } from './gardensRepo';
import { getOperations } from './operationsRepo';
import { getAccountReferralState } from './referralsRepo';
import {
    FREE_WATERING_OPERATION_ID,
    RAISED_BED_WATERING_50L_OPERATION_ID,
} from './seasonalOffersRepo';
import { getAllShoppingCarts } from './shoppingCartRepo';
import { listUserFavorites } from './userFavoritesRepo';
import { getUser } from './usersRepo';

export type TutorialChecklistGroupId = 'day-1' | 'day-2' | 'day-3' | 'open';

export type TutorialChecklistTaskStatus =
    | 'available'
    | 'blocked'
    | 'ready'
    | 'claimed'
    | 'completed';

export type TutorialChecklistActionTarget =
    | 'accountUsers'
    | 'achievements'
    | 'cart'
    | 'contact'
    | 'delivery'
    | 'diary'
    | 'field'
    | 'forecast'
    | 'garden'
    | 'inventory'
    | 'notifications'
    | 'operations'
    | 'plantDatabase'
    | 'profile'
    | 'raisedBedOnboarding'
    | 'referrals'
    | 'sunflowers'
    | 'weather';

type TutorialChecklistSignal =
    | 'accountUserInvited'
    | 'cartItemAdded'
    | 'dailyRewardClaimedDay2'
    | 'dailyRewardClaimedDay3'
    | 'deliveryAddressAdded'
    | 'favoriteAdded'
    | 'futureOperationScheduled'
    | 'gardenRenamed'
    | 'hasOperationHistory'
    | 'notificationSettingsCreated'
    | 'paidOrder'
    | 'plantingAchievement10'
    | 'plantedField'
    | 'raisedBedNinePlants'
    | 'referralRewarded'
    | 'secondGardenCreated'
    | 'usedReferralCode'
    | 'userProfileUpdated'
    | 'wateringAchievement10'
    | 'wateringOrdered'
    | 'harvestAchievement1';

type TutorialChecklistTaskDefinition = {
    key: string;
    groupId: TutorialChecklistGroupId;
    title: string;
    description: string;
    rewardSunflowers: number;
    rewardLabel?: string;
    completion: 'derived' | 'manual';
    signal?: TutorialChecklistSignal;
    requiresSignal?: TutorialChecklistSignal;
    blockedReason?: string;
    actionTarget?: TutorialChecklistActionTarget;
};

type TutorialChecklistSignals = Record<TutorialChecklistSignal, boolean>;

export type TutorialChecklistTask = TutorialChecklistTaskDefinition & {
    status: TutorialChecklistTaskStatus;
    completed: boolean;
    claimable: boolean;
    claimedAt: string | null;
};

export type TutorialChecklistGroup = {
    id: TutorialChecklistGroupId;
    title: string;
    description: string;
    tasks: TutorialChecklistTask[];
    completedCount: number;
    totalCount: number;
    claimableCount: number;
};

export type TutorialChecklistState = {
    groups: TutorialChecklistGroup[];
    totals: {
        completedCount: number;
        totalCount: number;
        claimableCount: number;
        availableSunflowers: number;
        earnedSunflowers: number;
    };
};

type TutorialChecklistTaskClaim =
    typeof tutorialChecklistTaskClaims.$inferSelect;

const WATERING_OPERATION_ENTITY_IDS = new Set([
    FREE_WATERING_OPERATION_ID,
    RAISED_BED_WATERING_50L_OPERATION_ID,
]);

const groupDefinitions = [
    {
        id: 'day-1',
        title: 'Dan 1',
        description: 'Postavi vrt, košaru i osnovne alate.',
    },
    {
        id: 'day-2',
        title: 'Dan 2',
        description: 'Provjeri nagrade, radnje, prognozu i biljke.',
    },
    {
        id: 'day-3',
        title: 'Dan 3',
        description: 'Uredi postavke i upoznaj naprednije dijelove aplikacije.',
    },
    {
        id: 'open',
        title: 'Otvoreni zadaci',
        description: 'Dodatne stvari koje možeš završiti bilo koji dan.',
    },
] satisfies Array<{
    id: TutorialChecklistGroupId;
    title: string;
    description: string;
}>;

const taskDefinitions = [
    {
        key: 'complete-first-raised-bed-onboarding',
        groupId: 'day-1',
        title: 'Dovrši plan prve gredice',
        description: 'Odaberi prijedlog i dodaj plan sadnje u košaru.',
        rewardSunflowers: 100,
        completion: 'manual',
        actionTarget: 'raisedBedOnboarding',
    },
    {
        key: 'plant-first',
        groupId: 'day-1',
        title: 'Postavi biljku u gredicu',
        description: 'Posadi barem jednu biljku u bilo koju aktivnu gredicu.',
        rewardSunflowers: 100,
        completion: 'derived',
        signal: 'plantedField',
        actionTarget: 'field',
    },
    {
        key: 'plant-nine-in-bed',
        groupId: 'day-1',
        title: 'Popuni gredicu s 9 biljaka',
        description: 'U jednu gredicu postavi najmanje 9 biljaka.',
        rewardSunflowers: 100,
        completion: 'derived',
        signal: 'raisedBedNinePlants',
        actionTarget: 'field',
    },
    {
        key: 'open-cart',
        groupId: 'day-1',
        title: 'Otvori košaru',
        description: 'Provjeri što je u košari i kako se naručuje.',
        rewardSunflowers: 25,
        completion: 'manual',
        actionTarget: 'cart',
    },
    {
        key: 'paid-order',
        groupId: 'day-1',
        title: 'Plati narudžbu',
        description: 'Završi checkout i plati barem jednu narudžbu.',
        rewardSunflowers: 100,
        completion: 'derived',
        signal: 'paidOrder',
        actionTarget: 'cart',
    },
    {
        key: 'order-watering',
        groupId: 'day-1',
        title: 'Naruči zalijevanje',
        description: 'Dodaj ili naruči radnju zalijevanja za svoju gredicu.',
        rewardSunflowers: 1000,
        completion: 'derived',
        signal: 'wateringOrdered',
        actionTarget: 'operations',
    },
    {
        key: 'open-operations',
        groupId: 'day-1',
        title: 'Otvori popis radnji',
        description: 'Pogledaj aktivne i planirane radnje u vrtu.',
        rewardSunflowers: 10,
        completion: 'manual',
        actionTarget: 'operations',
    },
    {
        key: 'open-sunflowers',
        groupId: 'day-1',
        title: 'Provjeri suncokrete',
        description: 'Otvori pregled stanja i aktivnosti suncokreta.',
        rewardSunflowers: 10,
        completion: 'manual',
        actionTarget: 'sunflowers',
    },
    {
        key: 'update-profile',
        groupId: 'day-1',
        title: 'Uredi profil',
        description: 'Dodaj ime za prikaz ili profilnu sliku.',
        rewardSunflowers: 100,
        completion: 'derived',
        signal: 'userProfileUpdated',
        actionTarget: 'profile',
    },
    {
        key: 'open-referrals',
        groupId: 'day-1',
        title: 'Otvori preporuke',
        description: 'Pronađi svoj kod preporuke i pozovi prijatelje.',
        rewardSunflowers: 100,
        completion: 'manual',
        actionTarget: 'referrals',
    },
    {
        key: 'claim-daily-reward-day-2',
        groupId: 'day-2',
        title: 'Preuzmi dnevnu nagradu',
        description: 'Preuzmi dnevnu nagradu drugi dan zaredom.',
        rewardSunflowers: 0,
        rewardLabel: 'Dnevna nagrada',
        completion: 'derived',
        signal: 'dailyRewardClaimedDay2',
        actionTarget: 'sunflowers',
    },
    {
        key: 'check-task-status',
        groupId: 'day-2',
        title: 'Provjeri status radnji',
        description: 'Otvori zadatke i provjeri što je planirano ili gotovo.',
        rewardSunflowers: 5,
        completion: 'manual',
        actionTarget: 'operations',
    },
    {
        key: 'open-operation-history',
        groupId: 'day-2',
        title: 'Pogledaj povijest radnji',
        description: 'Provjeri ima li vrt već zabilježene radnje.',
        rewardSunflowers: 10,
        completion: 'manual',
        requiresSignal: 'hasOperationHistory',
        blockedReason: 'Najprije dodaj ili naruči barem jednu radnju.',
        actionTarget: 'operations',
    },
    {
        key: 'check-order-status',
        groupId: 'day-2',
        title: 'Provjeri status narudžbe',
        description: 'Vrati se u košaru nakon prve plaćene narudžbe.',
        rewardSunflowers: 10,
        completion: 'manual',
        requiresSignal: 'paidOrder',
        blockedReason: 'Najprije završi i plati narudžbu.',
        actionTarget: 'cart',
    },
    {
        key: 'open-notifications',
        groupId: 'day-2',
        title: 'Otvori obavijesti',
        description: 'Pogledaj gdje se podešavaju obavijesti za vrt.',
        rewardSunflowers: 10,
        completion: 'manual',
        actionTarget: 'notifications',
    },
    {
        key: 'check-weather',
        groupId: 'day-2',
        title: 'Provjeri vrijeme',
        description: 'Pogledaj trenutno vrijeme za vrt.',
        rewardSunflowers: 10,
        completion: 'manual',
        actionTarget: 'weather',
    },
    {
        key: 'check-forecast',
        groupId: 'day-2',
        title: 'Provjeri prognozu',
        description: 'Otvori prognozu i planiraj sljedeći obilazak.',
        rewardSunflowers: 10,
        completion: 'manual',
        actionTarget: 'forecast',
    },
    {
        key: 'review-planted-field',
        groupId: 'day-2',
        title: 'Pregledaj posađeno polje',
        description: 'Vrati se na polje s posađenom biljkom.',
        rewardSunflowers: 25,
        completion: 'manual',
        requiresSignal: 'plantedField',
        blockedReason: 'Najprije posadi barem jednu biljku.',
        actionTarget: 'field',
    },
    {
        key: 'open-diary',
        groupId: 'day-2',
        title: 'Otvori dnevnik biljke',
        description: 'Pregledaj dnevnik na polju koje ima biljku.',
        rewardSunflowers: 25,
        completion: 'manual',
        requiresSignal: 'plantedField',
        blockedReason: 'Najprije posadi barem jednu biljku.',
        actionTarget: 'diary',
    },
    {
        key: 'favorite-one-item',
        groupId: 'day-2',
        title: 'Spremi favorit',
        description: 'Označi barem jednu biljku, sortu ili radnju kao favorit.',
        rewardSunflowers: 25,
        completion: 'derived',
        signal: 'favoriteAdded',
        actionTarget: 'plantDatabase',
    },
    {
        key: 'claim-daily-reward-day-3',
        groupId: 'day-3',
        title: 'Preuzmi treću dnevnu nagradu',
        description: 'Zadrži niz i preuzmi dnevnu nagradu treći dan.',
        rewardSunflowers: 0,
        rewardLabel: 'Dnevna nagrada',
        completion: 'derived',
        signal: 'dailyRewardClaimedDay3',
        actionTarget: 'sunflowers',
    },
    {
        key: 'open-achievements',
        groupId: 'day-3',
        title: 'Otvori postignuća',
        description: 'Provjeri koje te nagrade čekaju kroz aplikaciju.',
        rewardSunflowers: 20,
        completion: 'manual',
        actionTarget: 'achievements',
    },
    {
        key: 'review-sunflower-activity',
        groupId: 'day-3',
        title: 'Pregledaj aktivnost suncokreta',
        description: 'Otvori punu povijest zarade i trošenja suncokreta.',
        rewardSunflowers: 10,
        completion: 'manual',
        actionTarget: 'sunflowers',
    },
    {
        key: 'schedule-future-operation',
        groupId: 'day-3',
        title: 'Planiraj buduću radnju',
        description: 'Naruči radnju za budući datum.',
        rewardSunflowers: 50,
        completion: 'derived',
        signal: 'futureOperationScheduled',
        actionTarget: 'operations',
    },
    {
        key: 'configure-notifications',
        groupId: 'day-3',
        title: 'Podesi obavijesti',
        description: 'Spremi postavke obavijesti za svoj korisnički račun.',
        rewardSunflowers: 50,
        completion: 'derived',
        signal: 'notificationSettingsCreated',
        actionTarget: 'notifications',
    },
    {
        key: 'setup-delivery',
        groupId: 'day-3',
        title: 'Dodaj adresu dostave',
        description: 'Spremi adresu za buduće dostave iz vrta.',
        rewardSunflowers: 50,
        completion: 'derived',
        signal: 'deliveryAddressAdded',
        actionTarget: 'delivery',
    },
    {
        key: 'rename-garden',
        groupId: 'day-3',
        title: 'Preimenuj vrt',
        description: 'Daj svom vrtu osobno ime.',
        rewardSunflowers: 50,
        completion: 'derived',
        signal: 'gardenRenamed',
        actionTarget: 'garden',
    },
    {
        key: 'open-plant-database',
        groupId: 'day-3',
        title: 'Otvori bazu biljaka',
        description: 'Pregledaj biljke i sorte koje možeš uzgajati.',
        rewardSunflowers: 20,
        completion: 'manual',
        actionTarget: 'plantDatabase',
    },
    {
        key: 'enter-referral-code',
        groupId: 'open',
        title: 'Upiši kod preporuke',
        description: 'Iskoristi kod preporuke ako te netko pozvao.',
        rewardSunflowers: 100,
        completion: 'derived',
        signal: 'usedReferralCode',
        actionTarget: 'referrals',
    },
    {
        key: 'open-inventory',
        groupId: 'open',
        title: 'Otvori ruksak',
        description: 'Provjeri blokove i predmete koje imaš u inventaru.',
        rewardSunflowers: 10,
        completion: 'manual',
        actionTarget: 'inventory',
    },
    {
        key: 'open-contact',
        groupId: 'open',
        title: 'Pronađi kontakt',
        description: 'Saznaj gdje možeš poslati pitanje ili prijedlog.',
        rewardSunflowers: 10,
        completion: 'manual',
        actionTarget: 'contact',
    },
    {
        key: 'open-delivery',
        groupId: 'open',
        title: 'Otvori dostavu',
        description: 'Provjeri adrese, termine i buduće dostave.',
        rewardSunflowers: 10,
        completion: 'manual',
        actionTarget: 'delivery',
    },
    {
        key: 'invite-account-user',
        groupId: 'open',
        title: 'Pozovi korisnika na račun',
        description: 'Pošalji pozivnicu ili dodaj još jednog člana računa.',
        rewardSunflowers: 100,
        completion: 'derived',
        signal: 'accountUserInvited',
        actionTarget: 'accountUsers',
    },
    {
        key: 'create-second-garden',
        groupId: 'open',
        title: 'Dodaj drugi vrt',
        description: 'Napravi ili aktiviraj još jedan vrt.',
        rewardSunflowers: 100,
        completion: 'derived',
        signal: 'secondGardenCreated',
        actionTarget: 'garden',
    },
    {
        key: 'plant-ten-achievement',
        groupId: 'open',
        title: 'Osvoji postignuće za 10 biljaka',
        description: 'Posadi ukupno 10 biljaka i preuzmi postignuće.',
        rewardSunflowers: 0,
        rewardLabel: 'Postignuće',
        completion: 'derived',
        signal: 'plantingAchievement10',
        actionTarget: 'achievements',
    },
    {
        key: 'water-ten-achievement',
        groupId: 'open',
        title: 'Osvoji postignuće za 10 zalijevanja',
        description: 'Naruči ili dovrši 10 zalijevanja kroz aplikaciju.',
        rewardSunflowers: 0,
        rewardLabel: 'Postignuće',
        completion: 'derived',
        signal: 'wateringAchievement10',
        actionTarget: 'achievements',
    },
    {
        key: 'harvest-first-achievement',
        groupId: 'open',
        title: 'Osvoji prvo postignuće berbe',
        description: 'Zabilježi prvu berbu kada biljka bude spremna.',
        rewardSunflowers: 0,
        rewardLabel: 'Postignuće',
        completion: 'derived',
        signal: 'harvestAchievement1',
        actionTarget: 'achievements',
    },
    {
        key: 'successful-referral',
        groupId: 'open',
        title: 'Dovrši uspješnu preporuku',
        description:
            'Pozovi prijatelja koji posadi svoje prvo povrće u gredici.',
        rewardSunflowers: 0,
        rewardLabel: '10.000 🌻 kroz preporuke',
        completion: 'derived',
        signal: 'referralRewarded',
        actionTarget: 'referrals',
    },
] satisfies TutorialChecklistTaskDefinition[];

const taskDefinitionsByKey = new Map(
    taskDefinitions.map((task) => [task.key, task]),
);

export const tutorialChecklistTaskKeys = taskDefinitions.map(
    (task) => task.key,
);

export class TutorialChecklistTaskNotFoundError extends Error {
    constructor(taskKey: string) {
        super(`Unknown tutorial checklist task: ${taskKey}`);
        this.name = 'TutorialChecklistTaskNotFoundError';
    }
}

export class TutorialChecklistTaskNotClaimableError extends Error {
    constructor(
        public readonly taskKey: string,
        public readonly reason: string,
    ) {
        super(`Tutorial checklist task is not claimable: ${taskKey}`);
        this.name = 'TutorialChecklistTaskNotClaimableError';
    }
}

function emptySignals(): TutorialChecklistSignals {
    return {
        accountUserInvited: false,
        cartItemAdded: false,
        dailyRewardClaimedDay2: false,
        dailyRewardClaimedDay3: false,
        deliveryAddressAdded: false,
        favoriteAdded: false,
        futureOperationScheduled: false,
        gardenRenamed: false,
        harvestAchievement1: false,
        hasOperationHistory: false,
        notificationSettingsCreated: false,
        paidOrder: false,
        plantingAchievement10: false,
        plantedField: false,
        raisedBedNinePlants: false,
        referralRewarded: false,
        secondGardenCreated: false,
        usedReferralCode: false,
        userProfileUpdated: false,
        wateringAchievement10: false,
        wateringOrdered: false,
    };
}

function hasPlant(field: { plantSortId?: number; active?: boolean }) {
    return typeof field.plantSortId === 'number' && field.active !== false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getManualReadyTaskKey(value: unknown) {
    if (!isRecord(value) || typeof value.taskKey !== 'string') {
        return undefined;
    }

    const definition = taskDefinitionsByKey.get(value.taskKey);
    if (definition?.completion !== 'manual') {
        return undefined;
    }

    return value.taskKey;
}

async function getManualReadyTaskKeys(accountId: string) {
    const readyEvents = await getEvents(
        knownEventTypes.tutorialChecklist.taskReady,
        [accountId],
    );

    return new Set(
        readyEvents
            .map((event) => getManualReadyTaskKey(event.data))
            .filter((taskKey): taskKey is string => Boolean(taskKey)),
    );
}

function isPlantCartPlacement(item: {
    amount: number;
    entityTypeName: string;
    raisedBedId: number | null;
    positionIndex: number | null;
}): item is {
    amount: number;
    entityTypeName: string;
    raisedBedId: number;
    positionIndex: number;
} {
    return (
        item.entityTypeName === 'plantSort' &&
        item.amount > 0 &&
        typeof item.raisedBedId === 'number' &&
        typeof item.positionIndex === 'number'
    );
}

function markRaisedBedPlantPosition({
    plantedPositionsByRaisedBed,
    positionIndex,
    raisedBedId,
}: {
    plantedPositionsByRaisedBed: Map<number, Set<number>>;
    positionIndex: number;
    raisedBedId: number;
}) {
    const plantedPositions =
        plantedPositionsByRaisedBed.get(raisedBedId) ?? new Set<number>();
    plantedPositions.add(positionIndex);
    plantedPositionsByRaisedBed.set(raisedBedId, plantedPositions);
}

function isFutureDate(date: Date | undefined) {
    return date instanceof Date && date.getTime() > Date.now();
}

function hasAchievement(achievementKeys: Set<string>, key: string) {
    return achievementKeys.has(key);
}

async function getTutorialChecklistSignals({
    accountId,
    userId,
}: {
    accountId: string;
    userId: string;
}): Promise<TutorialChecklistSignals> {
    const [
        accountUsers,
        achievements,
        carts,
        deliveryAddresses,
        favorites,
        gardens,
        history,
        invitations,
        notificationSettings,
        operations,
        referralState,
        user,
    ] = await Promise.all([
        getAccountUsers(accountId),
        getAccountAchievements(accountId),
        getAllShoppingCarts({ status: null, filter: { accountId } }),
        getDeliveryAddresses(accountId),
        listUserFavorites({ userId }),
        getAccountGardens(accountId),
        getSunflowersHistory(accountId, 0, 10000),
        getAccountInvitations(accountId),
        storage().query.userNotificationSettings.findFirst({
            where: eq(userNotificationSettings.userId, userId),
        }),
        getOperations(accountId),
        getAccountReferralState(accountId, { createDefaultCode: false }),
        getUser(userId),
    ]);

    const signals = emptySignals();
    const plantedPositionsByRaisedBed = new Map<number, Set<number>>();

    for (const garden of gardens) {
        if (!garden.isSandbox) {
            signals.secondGardenCreated ||=
                gardens.filter((candidate) => !candidate.isSandbox).length >= 2;
        }
        for (const raisedBed of garden.raisedBeds) {
            for (const field of raisedBed.fields) {
                if (!hasPlant(field)) {
                    continue;
                }

                markRaisedBedPlantPosition({
                    plantedPositionsByRaisedBed,
                    positionIndex: field.positionIndex,
                    raisedBedId: raisedBed.id,
                });
            }
        }
    }

    const gardenIds = gardens.map((garden) => garden.id.toString());
    if (gardenIds.length > 0) {
        const renameEvents = await getEvents(
            [knownEventTypes.gardens.rename],
            gardenIds,
            0,
            1,
        );
        signals.gardenRenamed = renameEvents.length > 0;
    }

    signals.cartItemAdded = carts.some((cart) => cart.items.length > 0);
    for (const cart of carts) {
        for (const item of cart.items) {
            if (!isPlantCartPlacement(item)) {
                continue;
            }

            markRaisedBedPlantPosition({
                plantedPositionsByRaisedBed,
                positionIndex: item.positionIndex,
                raisedBedId: item.raisedBedId,
            });
        }
    }

    for (const plantedPositions of plantedPositionsByRaisedBed.values()) {
        if (plantedPositions.size > 0) {
            signals.plantedField = true;
        }
        if (plantedPositions.size >= 9) {
            signals.raisedBedNinePlants = true;
        }
    }

    signals.paidOrder = carts.some(
        (cart) =>
            cart.status === 'paid' ||
            cart.items.some((item) => item.status === 'paid'),
    );
    signals.wateringOrdered =
        carts.some((cart) =>
            cart.items.some(
                (item) =>
                    item.entityTypeName === 'operation' &&
                    WATERING_OPERATION_ENTITY_IDS.has(Number(item.entityId)),
            ),
        ) ||
        operations.some(
            (operation) =>
                operation.entityTypeName === 'operation' &&
                WATERING_OPERATION_ENTITY_IDS.has(operation.entityId) &&
                operation.status !== 'canceled',
        );
    signals.hasOperationHistory = operations.length > 0;
    signals.futureOperationScheduled = operations.some(
        (operation) =>
            operation.status === 'planned' &&
            isFutureDate(operation.scheduledDate),
    );

    const dailyRewardClaimedDays = new Set(
        history
            .map((event) =>
                typeof event.reason === 'string' &&
                event.reason.startsWith('daily:')
                    ? Number.parseInt(event.reason.split(':')[1] ?? '', 10)
                    : Number.NaN,
            )
            .filter((day) => Number.isFinite(day)),
    );
    signals.dailyRewardClaimedDay2 =
        dailyRewardClaimedDays.has(2) || dailyRewardClaimedDays.has(7);
    signals.dailyRewardClaimedDay3 =
        dailyRewardClaimedDays.has(3) || dailyRewardClaimedDays.has(7);

    const achievementKeys = new Set(
        achievements.map((achievement) => achievement.achievementKey),
    );
    const plantedFieldCount = Array.from(
        plantedPositionsByRaisedBed.values(),
    ).reduce((total, positions) => total + positions.size, 0);
    signals.plantingAchievement10 =
        plantedFieldCount >= 10 ||
        hasAchievement(achievementKeys, 'planting_10');
    signals.wateringAchievement10 = hasAchievement(
        achievementKeys,
        'watering_10',
    );
    signals.harvestAchievement1 = hasAchievement(achievementKeys, 'harvest_1');

    signals.userProfileUpdated = Boolean(
        user &&
            ((user.displayName && user.displayName !== user.userName) ||
                user.avatarUrl),
    );
    signals.favoriteAdded = favorites.length > 0;
    signals.notificationSettingsCreated = Boolean(notificationSettings);
    signals.deliveryAddressAdded = deliveryAddresses.length > 0;
    signals.accountUserInvited =
        accountUsers.length > 1 || invitations.length > 0;
    signals.usedReferralCode = Boolean(referralState.usedReferralCode);
    signals.referralRewarded = Boolean(
        referralState.usedReferral?.rewarded ||
            referralState.referredAccounts.some((account) => account.rewarded),
    );

    return signals;
}

function buildTask({
    claim,
    definition,
    manualReadyTaskKeys,
    signals,
}: {
    claim?: TutorialChecklistTaskClaim;
    definition: TutorialChecklistTaskDefinition;
    manualReadyTaskKeys: ReadonlySet<string>;
    signals: TutorialChecklistSignals;
}): TutorialChecklistTask {
    const claimed = Boolean(claim);
    const derivedComplete = definition.signal
        ? signals[definition.signal]
        : false;
    const manualReady =
        definition.completion === 'manual' &&
        manualReadyTaskKeys.has(definition.key);
    const requiredSignalSatisfied = definition.requiresSignal
        ? signals[definition.requiresSignal]
        : true;
    const blocked = !requiredSignalSatisfied;
    const claimable =
        !claimed &&
        !blocked &&
        definition.rewardSunflowers > 0 &&
        (derivedComplete || manualReady);
    const completed =
        claimed || (definition.rewardSunflowers === 0 && derivedComplete);
    const status: TutorialChecklistTaskStatus = claimed
        ? 'claimed'
        : blocked
          ? 'blocked'
          : definition.rewardSunflowers === 0 && derivedComplete
            ? 'completed'
            : claimable
              ? 'ready'
              : completed
                ? 'completed'
                : 'available';

    return {
        ...definition,
        blockedReason: blocked ? definition.blockedReason : undefined,
        claimedAt: claim?.claimedAt.toISOString() ?? null,
        claimable,
        completed,
        status,
    };
}

function buildState({
    claims,
    manualReadyTaskKeys,
    signals,
}: {
    claims: TutorialChecklistTaskClaim[];
    manualReadyTaskKeys: ReadonlySet<string>;
    signals: TutorialChecklistSignals;
}): TutorialChecklistState {
    const claimsByTaskKey = new Map(
        claims.map((claim) => [claim.taskKey, claim]),
    );
    const groups = groupDefinitions.map((group) => {
        const tasks = taskDefinitions
            .filter((definition) => definition.groupId === group.id)
            .map((definition) =>
                buildTask({
                    definition,
                    manualReadyTaskKeys,
                    signals,
                    claim: claimsByTaskKey.get(definition.key),
                }),
            );
        return {
            ...group,
            tasks,
            completedCount: tasks.filter((task) => task.completed).length,
            totalCount: tasks.length,
            claimableCount: tasks.filter((task) => task.claimable).length,
        };
    });
    const allTasks = groups.flatMap((group) => group.tasks);

    return {
        groups,
        totals: {
            completedCount: allTasks.filter((task) => task.completed).length,
            totalCount: allTasks.length,
            claimableCount: allTasks.filter((task) => task.claimable).length,
            availableSunflowers: allTasks
                .filter((task) => task.claimable)
                .reduce((total, task) => total + task.rewardSunflowers, 0),
            earnedSunflowers: claims.reduce(
                (total, claim) => total + claim.rewardSunflowers,
                0,
            ),
        },
    };
}

export async function getTutorialChecklistState({
    accountId,
    userId,
}: {
    accountId: string;
    userId: string;
}): Promise<TutorialChecklistState> {
    const [claims, manualReadyTaskKeys, signals] = await Promise.all([
        storage().query.tutorialChecklistTaskClaims.findMany({
            where: eq(tutorialChecklistTaskClaims.accountId, accountId),
            orderBy: tutorialChecklistTaskClaims.claimedAt,
        }),
        getManualReadyTaskKeys(accountId),
        getTutorialChecklistSignals({ accountId, userId }),
    ]);

    return buildState({ claims, manualReadyTaskKeys, signals });
}

export async function markTutorialChecklistTaskReady({
    accountId,
    taskKey,
    userId,
}: {
    accountId: string;
    taskKey: string;
    userId: string;
}) {
    const definition = taskDefinitionsByKey.get(taskKey);
    if (!definition) {
        throw new TutorialChecklistTaskNotFoundError(taskKey);
    }

    if (definition.completion !== 'manual') {
        throw new TutorialChecklistTaskNotClaimableError(taskKey, 'not_manual');
    }

    const [manualReadyTaskKeys, signals, existingClaim] = await Promise.all([
        getManualReadyTaskKeys(accountId),
        getTutorialChecklistSignals({ accountId, userId }),
        storage().query.tutorialChecklistTaskClaims.findFirst({
            where: and(
                eq(tutorialChecklistTaskClaims.accountId, accountId),
                eq(tutorialChecklistTaskClaims.taskKey, taskKey),
            ),
        }),
    ]);
    const task = buildTask({
        definition,
        manualReadyTaskKeys,
        signals,
        claim: existingClaim,
    });

    if (task.completed || task.claimable) {
        return getTutorialChecklistState({ accountId, userId });
    }

    if (task.status === 'blocked') {
        throw new TutorialChecklistTaskNotClaimableError(
            taskKey,
            task.blockedReason ?? 'blocked',
        );
    }

    await createEvent({
        type: knownEventTypes.tutorialChecklist.taskReady,
        version: 1,
        aggregateId: accountId,
        data: {
            taskKey,
            userId,
        },
    });

    return getTutorialChecklistState({ accountId, userId });
}

export async function claimTutorialChecklistTask({
    accountId,
    taskKey,
    userId,
}: {
    accountId: string;
    taskKey: string;
    userId: string;
}) {
    const definition = taskDefinitionsByKey.get(taskKey);
    if (!definition) {
        throw new TutorialChecklistTaskNotFoundError(taskKey);
    }

    const [manualReadyTaskKeys, signals, existingClaim] = await Promise.all([
        getManualReadyTaskKeys(accountId),
        getTutorialChecklistSignals({ accountId, userId }),
        storage().query.tutorialChecklistTaskClaims.findFirst({
            where: and(
                eq(tutorialChecklistTaskClaims.accountId, accountId),
                eq(tutorialChecklistTaskClaims.taskKey, taskKey),
            ),
        }),
    ]);
    const task = buildTask({
        definition,
        manualReadyTaskKeys,
        signals,
        claim: existingClaim,
    });

    if (!task.claimable) {
        const reason = task.completed
            ? 'completed'
            : (task.blockedReason ?? 'not_ready');
        throw new TutorialChecklistTaskNotClaimableError(taskKey, reason);
    }

    await insertTutorialChecklistClaim({
        accountId,
        rewardSunflowers: definition.rewardSunflowers,
        taskKey,
    });

    return getTutorialChecklistState({ accountId, userId });
}

async function insertTutorialChecklistClaim({
    accountId,
    rewardSunflowers,
    taskKey,
}: {
    accountId: string;
    rewardSunflowers: number;
    taskKey: string;
}) {
    let created = false;
    await storage().transaction(async (tx) => {
        const [claim] = await tx
            .insert(tutorialChecklistTaskClaims)
            .values({
                accountId,
                taskKey,
                rewardSunflowers,
            })
            .onConflictDoNothing({
                target: [
                    tutorialChecklistTaskClaims.accountId,
                    tutorialChecklistTaskClaims.taskKey,
                ],
            })
            .returning({
                id: tutorialChecklistTaskClaims.id,
            });

        if (!claim) {
            return;
        }

        created = true;
        if (rewardSunflowers > 0) {
            await earnSunflowers(
                accountId,
                rewardSunflowers,
                `tutorial:${taskKey}`,
                tx,
            );
        }
    });

    return created;
}
