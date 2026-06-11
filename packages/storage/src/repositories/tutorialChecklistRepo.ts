import 'server-only';

import { and, asc, eq, inArray } from 'drizzle-orm';
import {
    accounts as accountsTable,
    accountUsers as accountUsersTable,
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
import { getEvents, knownEventTypes } from './eventsRepo';
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

type TutorialChecklistBackfillTaskResult = {
    taskKey: string;
    title: string;
    rewardSunflowers: number;
    existingClaims: number;
    createdClaims: number;
    wouldCreateClaims: number;
    grantedSunflowers: number;
    wouldGrantSunflowers: number;
};

export type TutorialChecklistBackfillResult = {
    dryRun: boolean;
    scannedAccounts: number;
    eligibleAccounts: number;
    skippedAccountsWithoutUser: number;
    existingClaims: number;
    createdClaims: number;
    wouldCreateClaims: number;
    grantedSunflowers: number;
    wouldGrantSunflowers: number;
    tasks: TutorialChecklistBackfillTaskResult[];
};

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
        description: 'Uredi postavke i upoznaj naprednije dijelove igre.',
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
        description: 'Provjeri koje te nagrade čekaju kroz igru.',
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
        groupId: 'day-3',
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
        description: 'Naruči ili dovrši 10 zalijevanja kroz igru.',
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
        description: 'Pozovi prijatelja koji aktivira svoj vrt.',
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

const backfillableTaskDefinitions = taskDefinitions.filter(
    (task) => task.completion === 'derived' && task.rewardSunflowers > 0,
);

export const tutorialChecklistBackfillTaskKeys =
    backfillableTaskDefinitions.map((task) => task.key);

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

function isFutureDate(date: Date | undefined) {
    return date instanceof Date && date.getTime() > Date.now();
}

function hasAchievement(achievementKeys: Set<string>, key: string) {
    return achievementKeys.has(key);
}

function emptyBackfillResult(dryRun: boolean): TutorialChecklistBackfillResult {
    return {
        dryRun,
        scannedAccounts: 0,
        eligibleAccounts: 0,
        skippedAccountsWithoutUser: 0,
        existingClaims: 0,
        createdClaims: 0,
        wouldCreateClaims: 0,
        grantedSunflowers: 0,
        wouldGrantSunflowers: 0,
        tasks: backfillableTaskDefinitions.map((task) => ({
            taskKey: task.key,
            title: task.title,
            rewardSunflowers: task.rewardSunflowers,
            existingClaims: 0,
            createdClaims: 0,
            wouldCreateClaims: 0,
            grantedSunflowers: 0,
            wouldGrantSunflowers: 0,
        })),
    };
}

function findBackfillTaskResult(
    result: TutorialChecklistBackfillResult,
    taskKey: string,
) {
    const taskResult = result.tasks.find((task) => task.taskKey === taskKey);
    if (!taskResult) {
        throw new Error(`Unknown tutorial checklist backfill task: ${taskKey}`);
    }
    return taskResult;
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
    const plantedFieldsByRaisedBed = new Map<number, number>();

    for (const garden of gardens) {
        if (!garden.isSandbox) {
            signals.secondGardenCreated ||=
                gardens.filter((candidate) => !candidate.isSandbox).length >= 2;
        }
        for (const raisedBed of garden.raisedBeds) {
            const plantedFields = raisedBed.fields.filter(hasPlant).length;
            if (plantedFields > 0) {
                signals.plantedField = true;
            }
            plantedFieldsByRaisedBed.set(raisedBed.id, plantedFields);
            if (plantedFields >= 9) {
                signals.raisedBedNinePlants = true;
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
        plantedFieldsByRaisedBed.values(),
    ).reduce((total, count) => total + count, 0);
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
    signals,
}: {
    claim?: TutorialChecklistTaskClaim;
    definition: TutorialChecklistTaskDefinition;
    signals: TutorialChecklistSignals;
}): TutorialChecklistTask {
    const claimed = Boolean(claim);
    const derivedComplete = definition.signal
        ? signals[definition.signal]
        : false;
    const requiredSignalSatisfied = definition.requiresSignal
        ? signals[definition.requiresSignal]
        : true;
    const blocked = !requiredSignalSatisfied;
    const alreadyComplete = claimed || derivedComplete;
    const claimable =
        !claimed &&
        !blocked &&
        (definition.completion === 'manual' ||
            (definition.rewardSunflowers > 0 && derivedComplete));
    const completed =
        alreadyComplete ||
        (definition.rewardSunflowers === 0 && derivedComplete);
    const status: TutorialChecklistTaskStatus = claimed
        ? 'claimed'
        : blocked
          ? 'blocked'
          : definition.rewardSunflowers === 0 && derivedComplete
            ? 'completed'
            : claimable && derivedComplete
              ? 'ready'
              : claimable
                ? 'available'
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
    signals,
}: {
    claims: TutorialChecklistTaskClaim[];
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
    const [claims, signals] = await Promise.all([
        storage().query.tutorialChecklistTaskClaims.findMany({
            where: eq(tutorialChecklistTaskClaims.accountId, accountId),
            orderBy: tutorialChecklistTaskClaims.claimedAt,
        }),
        getTutorialChecklistSignals({ accountId, userId }),
    ]);

    return buildState({ claims, signals });
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

    const signals = await getTutorialChecklistSignals({ accountId, userId });
    const existingClaim =
        await storage().query.tutorialChecklistTaskClaims.findFirst({
            where: and(
                eq(tutorialChecklistTaskClaims.accountId, accountId),
                eq(tutorialChecklistTaskClaims.taskKey, taskKey),
            ),
        });
    const task = buildTask({
        definition,
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

export async function backfillTutorialChecklistRewards({
    accountIds,
    dryRun = true,
    limit,
    offset = 0,
}: {
    accountIds?: string[];
    dryRun?: boolean;
    limit?: number;
    offset?: number;
} = {}): Promise<TutorialChecklistBackfillResult> {
    const safeLimit =
        typeof limit === 'number'
            ? Math.min(Math.max(Math.trunc(limit), 1), 5000)
            : undefined;
    const safeOffset = Math.max(Math.trunc(offset), 0);
    const uniqueAccountIds = accountIds
        ? Array.from(new Set(accountIds.filter(Boolean)))
        : undefined;
    const accountRows = await storage().query.accounts.findMany({
        where:
            uniqueAccountIds && uniqueAccountIds.length > 0
                ? inArray(accountsTable.id, uniqueAccountIds)
                : undefined,
        with: {
            accountUsers: {
                with: {
                    user: true,
                },
                orderBy: asc(accountUsersTable.createdAt),
            },
        },
        orderBy: [asc(accountsTable.createdAt), asc(accountsTable.id)],
        limit: safeLimit,
        offset: safeOffset,
    });
    const result = emptyBackfillResult(dryRun);
    result.scannedAccounts = accountRows.length;

    for (const account of accountRows) {
        const userId = account.accountUsers[0]?.user.id;
        if (!userId) {
            result.skippedAccountsWithoutUser++;
            continue;
        }

        const [claims, signals] = await Promise.all([
            storage().query.tutorialChecklistTaskClaims.findMany({
                where: eq(tutorialChecklistTaskClaims.accountId, account.id),
            }),
            getTutorialChecklistSignals({ accountId: account.id, userId }),
        ]);
        const claimsByTaskKey = new Map(
            claims.map((claim) => [claim.taskKey, claim]),
        );
        const completedTasks = backfillableTaskDefinitions.map((definition) =>
            buildTask({
                definition,
                signals,
                claim: claimsByTaskKey.get(definition.key),
            }),
        );
        const alreadyClaimedTasks = completedTasks.filter(
            (task) => task.status === 'claimed',
        );
        for (const task of alreadyClaimedTasks) {
            result.existingClaims++;
            findBackfillTaskResult(result, task.key).existingClaims++;
        }

        const tasksToBackfill = completedTasks.filter((task) => task.claimable);
        if (tasksToBackfill.length === 0) {
            continue;
        }

        result.eligibleAccounts++;
        for (const task of tasksToBackfill) {
            const taskResult = findBackfillTaskResult(result, task.key);
            if (dryRun) {
                result.wouldCreateClaims++;
                result.wouldGrantSunflowers += task.rewardSunflowers;
                taskResult.wouldCreateClaims++;
                taskResult.wouldGrantSunflowers += task.rewardSunflowers;
                continue;
            }

            const created = await insertTutorialChecklistClaim({
                accountId: account.id,
                rewardSunflowers: task.rewardSunflowers,
                taskKey: task.key,
            });
            if (created) {
                result.createdClaims++;
                result.grantedSunflowers += task.rewardSunflowers;
                taskResult.createdClaims++;
                taskResult.grantedSunflowers += task.rewardSunflowers;
            } else {
                result.existingClaims++;
                taskResult.existingClaims++;
            }
        }
    }

    return result;
}
