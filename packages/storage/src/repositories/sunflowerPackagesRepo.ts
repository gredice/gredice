import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import {
    attributeDefinitionCategories,
    attributeDefinitions,
    attributeValues,
    createEntity,
    entities,
    entityTypeCategories,
    entityTypes,
    getAttributeDefinitions,
    getEntitiesFormatted,
    hasPurchasedSunflowerPackage,
    type SelectAttributeDefinition,
    storage,
    updateEntity,
    upsertAttributeValue,
} from '..';

export const sunflowerPackageEntityTypeName = 'sunflowerPackage';

export const sunflowerPackageRoles = [
    'initial_one_time',
    'main',
    'upsell',
] as const;

export type SunflowerPackageRole = (typeof sunflowerPackageRoles)[number];

export type SunflowerPackage = {
    entityId: number;
    code: string;
    name: string;
    tag: string | null;
    descriptionShort: string | null;
    descriptionLong: string | null;
    cta: string | null;
    displayOrder: number;
    priceCents: number;
    priceEur: number;
    currency: string;
    sunflowers: number;
    baseSunflowers: number;
    bonusSunflowers: number;
    bonusPercentage: number;
    role: SunflowerPackageRole;
    isActive: boolean;
    isOneTime: boolean;
    oneTimeScope: 'account' | null;
    upsellTriggerCode: string | null;
    showInPrimaryList: boolean;
    stripeLookupKey: string | null;
    eligible?: boolean;
    ineligibleReason?: 'already_purchased';
};

type FormattedSunflowerPackageEntity = {
    id: number;
    presentation?: Record<string, unknown>;
    pricing?: Record<string, unknown>;
    availability?: Record<string, unknown>;
    operations?: Record<string, unknown>;
};

type AttributeDefinitionSpec = Pick<
    SelectAttributeDefinition,
    | 'category'
    | 'name'
    | 'label'
    | 'description'
    | 'dataType'
    | 'defaultValue'
    | 'unit'
    | 'order'
    | 'multiple'
    | 'required'
    | 'display'
>;

type SeedSunflowerPackageSpec = {
    code: string;
    name: string;
    tag: string | null;
    descriptionShort: string;
    descriptionLong: string;
    priceEur: string;
    currency: 'eur';
    sunflowers: number;
    baseSunflowers: number;
    role: SunflowerPackageRole;
    isOneTime: boolean;
    oneTimeScope: 'account' | null;
    upsellTriggerCode: string | null;
    showInPrimaryList: boolean;
    displayOrder: number;
    stripeLookupKey: string | null;
};

const seedActor = {
    id: 'sunflower-package-seed',
    name: 'Sunflower package seed',
};

const packageEntityTypeCategory = {
    name: 'commerce',
    label: 'Trgovina',
    icon: 'ShoppingBasket',
    order: '50',
};

const packageAttributeCategories = [
    {
        name: 'presentation',
        label: 'Prikaz',
        order: '10',
    },
    {
        name: 'pricing',
        label: 'Cijene',
        order: '20',
    },
    {
        name: 'availability',
        label: 'Dostupnost',
        order: '30',
    },
    {
        name: 'operations',
        label: 'Operacije',
        order: '40',
    },
] as const;

const packageAttributeDefinitions: AttributeDefinitionSpec[] = [
    {
        category: 'presentation',
        name: 'code',
        label: 'Kod paketa',
        description:
            'Stabilni tehnički kod paketa. Koristi se za checkout, eligibility i ledger povezivanje.',
        dataType: 'text',
        defaultValue: null,
        unit: null,
        order: '10',
        multiple: false,
        required: true,
        display: true,
    },
    {
        category: 'presentation',
        name: 'name',
        label: 'Naziv',
        description: null,
        dataType: 'text',
        defaultValue: null,
        unit: null,
        order: '20',
        multiple: false,
        required: true,
        display: true,
    },
    {
        category: 'presentation',
        name: 'tag',
        label: 'Oznaka',
        description: 'Kratka marketinška oznaka poput Najpopularnije.',
        dataType: 'text',
        defaultValue: null,
        unit: null,
        order: '30',
        multiple: false,
        required: false,
        display: true,
    },
    {
        category: 'presentation',
        name: 'descriptionShort',
        label: 'Kratki opis',
        description: null,
        dataType: 'text',
        defaultValue: null,
        unit: null,
        order: '40',
        multiple: false,
        required: false,
        display: false,
    },
    {
        category: 'presentation',
        name: 'descriptionLong',
        label: 'Dugi opis',
        description: null,
        dataType: 'text',
        defaultValue: null,
        unit: null,
        order: '50',
        multiple: false,
        required: false,
        display: false,
    },
    {
        category: 'presentation',
        name: 'cta',
        label: 'CTA',
        description: null,
        dataType: 'text',
        defaultValue: 'Kupi paket',
        unit: null,
        order: '60',
        multiple: false,
        required: false,
        display: false,
    },
    {
        category: 'presentation',
        name: 'displayOrder',
        label: 'Redoslijed prikaza',
        description: null,
        dataType: 'number',
        defaultValue: null,
        unit: null,
        order: '70',
        multiple: false,
        required: true,
        display: true,
    },
    {
        category: 'pricing',
        name: 'priceEur',
        label: 'Cijena',
        description: 'Decimalna EUR cijena, bez lokaliziranog formatiranja.',
        dataType: 'number',
        defaultValue: null,
        unit: 'EUR',
        order: '10',
        multiple: false,
        required: true,
        display: true,
    },
    {
        category: 'pricing',
        name: 'currency',
        label: 'Valuta naplate',
        description: null,
        dataType: 'text',
        defaultValue: 'eur',
        unit: null,
        order: '20',
        multiple: false,
        required: true,
        display: true,
    },
    {
        category: 'pricing',
        name: 'sunflowers',
        label: 'Suncokreti',
        description:
            'Ukupan broj suncokreta koji paket dodaje na Gredice saldo.',
        dataType: 'number',
        defaultValue: null,
        unit: 'suncokreti',
        order: '30',
        multiple: false,
        required: true,
        display: true,
    },
    {
        category: 'pricing',
        name: 'baseSunflowers',
        label: 'Osnovni suncokreti',
        description: null,
        dataType: 'number',
        defaultValue: null,
        unit: 'suncokreti',
        order: '40',
        multiple: false,
        required: true,
        display: false,
    },
    {
        category: 'pricing',
        name: 'bonusSunflowers',
        label: 'Bonus suncokreti',
        description: null,
        dataType: 'number',
        defaultValue: '0',
        unit: 'suncokreti',
        order: '50',
        multiple: false,
        required: true,
        display: true,
    },
    {
        category: 'pricing',
        name: 'bonusPercentage',
        label: 'Bonus postotak',
        description: null,
        dataType: 'number',
        defaultValue: '0',
        unit: '%',
        order: '60',
        multiple: false,
        required: true,
        display: false,
    },
    {
        category: 'availability',
        name: 'isActive',
        label: 'Aktivan',
        description:
            'Neaktivni paketi ostaju u adminu, ali se ne prikazuju kupcima.',
        dataType: 'boolean',
        defaultValue: 'true',
        unit: null,
        order: '10',
        multiple: false,
        required: true,
        display: true,
    },
    {
        category: 'availability',
        name: 'packageRole',
        label: 'Uloga paketa',
        description: 'initial_one_time, main ili upsell.',
        dataType: 'text',
        defaultValue: 'main',
        unit: null,
        order: '20',
        multiple: false,
        required: true,
        display: true,
    },
    {
        category: 'availability',
        name: 'isOneTime',
        label: 'Jednokratna kupnja',
        description: null,
        dataType: 'boolean',
        defaultValue: 'false',
        unit: null,
        order: '30',
        multiple: false,
        required: true,
        display: true,
    },
    {
        category: 'availability',
        name: 'oneTimeScope',
        label: 'Opseg jednokratnosti',
        description: 'Za MVP je podržan account.',
        dataType: 'text',
        defaultValue: null,
        unit: null,
        order: '40',
        multiple: false,
        required: false,
        display: false,
    },
    {
        category: 'availability',
        name: 'upsellTriggerCode',
        label: 'Kod okidača za upsell',
        description: null,
        dataType: 'text',
        defaultValue: null,
        unit: null,
        order: '50',
        multiple: false,
        required: false,
        display: false,
    },
    {
        category: 'availability',
        name: 'showInPrimaryList',
        label: 'Prikaži u glavnom popisu',
        description: null,
        dataType: 'boolean',
        defaultValue: 'true',
        unit: null,
        order: '60',
        multiple: false,
        required: true,
        display: true,
    },
    {
        category: 'operations',
        name: 'stripeLookupKey',
        label: 'Stripe lookup key',
        description:
            'Opcionalna veza na unaprijed kreiranu Stripe cijenu. Ako je prazno, checkout smije koristiti entity cijenu.',
        dataType: 'text',
        defaultValue: null,
        unit: null,
        order: '10',
        multiple: false,
        required: false,
        display: false,
    },
];

export const sunflowerPackageSeedSpecs: SeedSunflowerPackageSpec[] = [
    {
        code: 'puna_gredica',
        name: 'Puna gredica',
        tag: 'Jednokratna ponuda',
        descriptionShort: 'Početni paket za prvu veliku kupnju u vrtu.',
        descriptionLong:
            'Jednokratna uplata Gredice salda za korisnike koji tek pokreću svoj vrt.',
        priceEur: '49.99',
        currency: 'eur',
        sunflowers: 60000,
        baseSunflowers: 50000,
        role: 'initial_one_time',
        isOneTime: true,
        oneTimeScope: 'account',
        upsellTriggerCode: null,
        showInPrimaryList: false,
        displayOrder: 10,
        stripeLookupKey: null,
    },
    {
        code: 'mali_zalogaj',
        name: 'Mali zalogaj',
        tag: null,
        descriptionShort: 'Mala nadoplata za brzu vrtnu akciju.',
        descriptionLong:
            'Paket za manje narudžbe i korisnike koji žele nadopuniti saldo po potrebi.',
        priceEur: '4.99',
        currency: 'eur',
        sunflowers: 5000,
        baseSunflowers: 5000,
        role: 'main',
        isOneTime: false,
        oneTimeScope: null,
        upsellTriggerCode: null,
        showInPrimaryList: true,
        displayOrder: 20,
        stripeLookupKey: null,
    },
    {
        code: 'vrtna_kosarica',
        name: 'Vrtna košarica',
        tag: 'Najpopularnije',
        descriptionShort: 'Najpraktičniji paket za redovite vrtne narudžbe.',
        descriptionLong:
            'Repeatable paket Gredice salda s bonus suncokretima za korisnike koji redovito naručuju usluge u vrtu.',
        priceEur: '39.99',
        currency: 'eur',
        sunflowers: 42000,
        baseSunflowers: 40000,
        role: 'main',
        isOneTime: false,
        oneTimeScope: null,
        upsellTriggerCode: null,
        showInPrimaryList: true,
        displayOrder: 30,
        stripeLookupKey: null,
    },
    {
        code: 'mirna_sezona',
        name: 'Mirna sezona',
        tag: 'Najbolja vrijednost',
        descriptionShort: 'Veći saldo za mirnu sezonu održavanja vrta.',
        descriptionLong:
            'Veći paket za korisnike koji žele unaprijed pokriti učestale vrtne usluge tijekom sezone.',
        priceEur: '99.99',
        currency: 'eur',
        sunflowers: 110000,
        baseSunflowers: 100000,
        role: 'main',
        isOneTime: false,
        oneTimeScope: null,
        upsellTriggerCode: null,
        showInPrimaryList: true,
        displayOrder: 40,
        stripeLookupKey: null,
    },
    {
        code: 'majstor_vrtlar',
        name: 'Majstor vrtlar',
        tag: 'Master upsell',
        descriptionShort: 'Najveći paket za intenzivnu vrtnu sezonu.',
        descriptionLong:
            'Upsell paket koji se prikazuje nakon odabira paketa Mirna sezona.',
        priceEur: '269.99',
        currency: 'eur',
        sunflowers: 300000,
        baseSunflowers: 270000,
        role: 'upsell',
        isOneTime: false,
        oneTimeScope: null,
        upsellTriggerCode: 'mirna_sezona',
        showInPrimaryList: false,
        displayOrder: 50,
        stripeLookupKey: null,
    },
];

function attributePath(definition: SelectAttributeDefinition) {
    return `${definition.category}.${definition.name}`;
}

function isRole(value: string): value is SunflowerPackageRole {
    return sunflowerPackageRoles.some((role) => role === value);
}

function readString(
    record: Record<string, unknown> | undefined,
    key: string,
    fieldName: string,
    options?: { required?: boolean },
) {
    const value = record?.[key];
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
            return trimmed;
        }
    }
    if (options?.required) {
        throw new Error(`Sunflower package ${fieldName} is required.`);
    }
    return null;
}

function readNumber(
    record: Record<string, unknown> | undefined,
    key: string,
    fieldName: string,
) {
    const value = record?.[key];
    const numberValue =
        typeof value === 'number'
            ? value
            : typeof value === 'string'
              ? /^-?\d+(?:\.\d+)?$/u.test(value.trim())
                  ? Number(value.trim())
                  : Number.NaN
              : Number.NaN;
    if (!Number.isFinite(numberValue)) {
        throw new Error(`Sunflower package ${fieldName} must be numeric.`);
    }
    return numberValue;
}

function readBoolean(
    record: Record<string, unknown> | undefined,
    key: string,
    defaultValue: boolean,
) {
    const value = record?.[key];
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        return value === 'true';
    }
    return defaultValue;
}

function normalizeSunflowerPackage(
    entity: FormattedSunflowerPackageEntity,
): SunflowerPackage {
    const code = readString(entity.presentation, 'code', 'presentation.code', {
        required: true,
    });
    const name = readString(entity.presentation, 'name', 'presentation.name', {
        required: true,
    });
    const priceEur = readNumber(entity.pricing, 'priceEur', 'pricing.priceEur');
    const sunflowers = readNumber(
        entity.pricing,
        'sunflowers',
        'pricing.sunflowers',
    );
    const baseSunflowers = readNumber(
        entity.pricing,
        'baseSunflowers',
        'pricing.baseSunflowers',
    );
    const bonusSunflowers = readNumber(
        entity.pricing,
        'bonusSunflowers',
        'pricing.bonusSunflowers',
    );
    const bonusPercentage = readNumber(
        entity.pricing,
        'bonusPercentage',
        'pricing.bonusPercentage',
    );
    const displayOrder = readNumber(
        entity.presentation,
        'displayOrder',
        'presentation.displayOrder',
    );
    const roleValue = readString(
        entity.availability,
        'packageRole',
        'availability.packageRole',
        { required: true },
    );
    if (!roleValue || !isRole(roleValue)) {
        throw new Error(
            `Sunflower package ${code} has invalid packageRole ${roleValue ?? 'null'}.`,
        );
    }
    const currency = readString(
        entity.pricing,
        'currency',
        'pricing.currency',
        {
            required: true,
        },
    );
    if (!currency) {
        throw new Error(`Sunflower package ${code} currency is required.`);
    }

    return {
        entityId: entity.id,
        code: code ?? '',
        name: name ?? '',
        tag: readString(entity.presentation, 'tag', 'presentation.tag'),
        descriptionShort: readString(
            entity.presentation,
            'descriptionShort',
            'presentation.descriptionShort',
        ),
        descriptionLong: readString(
            entity.presentation,
            'descriptionLong',
            'presentation.descriptionLong',
        ),
        cta: readString(entity.presentation, 'cta', 'presentation.cta'),
        displayOrder,
        priceCents: Math.round(priceEur * 100),
        priceEur,
        currency,
        sunflowers,
        baseSunflowers,
        bonusSunflowers,
        bonusPercentage,
        role: roleValue,
        isActive: readBoolean(entity.availability, 'isActive', true),
        isOneTime: readBoolean(entity.availability, 'isOneTime', false),
        oneTimeScope:
            readString(
                entity.availability,
                'oneTimeScope',
                'availability.oneTimeScope',
            ) === 'account'
                ? 'account'
                : null,
        upsellTriggerCode: readString(
            entity.availability,
            'upsellTriggerCode',
            'availability.upsellTriggerCode',
        ),
        showInPrimaryList: readBoolean(
            entity.availability,
            'showInPrimaryList',
            true,
        ),
        stripeLookupKey: readString(
            entity.operations,
            'stripeLookupKey',
            'operations.stripeLookupKey',
        ),
    };
}

function packageValues(spec: SeedSunflowerPackageSpec) {
    const bonusSunflowers = spec.sunflowers - spec.baseSunflowers;
    const bonusPercentage =
        spec.baseSunflowers > 0
            ? Math.round((bonusSunflowers / spec.baseSunflowers) * 100)
            : 0;

    return {
        'presentation.code': spec.code,
        'presentation.name': spec.name,
        'presentation.tag': spec.tag,
        'presentation.descriptionShort': spec.descriptionShort,
        'presentation.descriptionLong': spec.descriptionLong,
        'presentation.cta': 'Kupi paket',
        'presentation.displayOrder': String(spec.displayOrder),
        'pricing.priceEur': spec.priceEur,
        'pricing.currency': spec.currency,
        'pricing.sunflowers': String(spec.sunflowers),
        'pricing.baseSunflowers': String(spec.baseSunflowers),
        'pricing.bonusSunflowers': String(bonusSunflowers),
        'pricing.bonusPercentage': String(bonusPercentage),
        'availability.isActive': 'true',
        'availability.packageRole': spec.role,
        'availability.isOneTime': String(spec.isOneTime),
        'availability.oneTimeScope': spec.oneTimeScope,
        'availability.upsellTriggerCode': spec.upsellTriggerCode,
        'availability.showInPrimaryList': String(spec.showInPrimaryList),
        'operations.stripeLookupKey': spec.stripeLookupKey,
    } satisfies Record<string, string | null>;
}

async function ensureEntityTypeCategory() {
    const [existing] = await storage()
        .select()
        .from(entityTypeCategories)
        .where(
            and(
                eq(entityTypeCategories.name, packageEntityTypeCategory.name),
                eq(entityTypeCategories.isDeleted, false),
            ),
        )
        .limit(1);

    if (!existing) {
        const [created] = await storage()
            .insert(entityTypeCategories)
            .values(packageEntityTypeCategory)
            .returning({ id: entityTypeCategories.id });
        return created.id;
    }

    await storage()
        .update(entityTypeCategories)
        .set(packageEntityTypeCategory)
        .where(eq(entityTypeCategories.id, existing.id));
    return existing.id;
}

async function ensureEntityType(categoryId: number) {
    const [existing] = await storage()
        .select()
        .from(entityTypes)
        .where(
            and(
                eq(entityTypes.name, sunflowerPackageEntityTypeName),
                eq(entityTypes.isDeleted, false),
            ),
        )
        .limit(1);

    const values = {
        name: sunflowerPackageEntityTypeName,
        label: 'Paket suncokreta',
        icon: 'BadgeEuro',
        categoryId,
        order: '40',
        isRoot: true,
    };

    if (!existing) {
        await storage().insert(entityTypes).values(values);
        return;
    }

    await storage()
        .update(entityTypes)
        .set(values)
        .where(eq(entityTypes.id, existing.id));
}

async function ensureAttributeCategories() {
    for (const category of packageAttributeCategories) {
        const [existing] = await storage()
            .select()
            .from(attributeDefinitionCategories)
            .where(
                and(
                    eq(attributeDefinitionCategories.name, category.name),
                    eq(
                        attributeDefinitionCategories.entityTypeName,
                        sunflowerPackageEntityTypeName,
                    ),
                    eq(attributeDefinitionCategories.isDeleted, false),
                ),
            )
            .limit(1);

        const values = {
            ...category,
            entityTypeName: sunflowerPackageEntityTypeName,
        };

        if (!existing) {
            await storage()
                .insert(attributeDefinitionCategories)
                .values(values);
            continue;
        }

        await storage()
            .update(attributeDefinitionCategories)
            .set(values)
            .where(eq(attributeDefinitionCategories.id, existing.id));
    }
}

async function ensureAttributeDefinitions() {
    for (const definition of packageAttributeDefinitions) {
        const [existing] = await storage()
            .select()
            .from(attributeDefinitions)
            .where(
                and(
                    eq(
                        attributeDefinitions.entityTypeName,
                        sunflowerPackageEntityTypeName,
                    ),
                    eq(attributeDefinitions.category, definition.category),
                    eq(attributeDefinitions.name, definition.name),
                    eq(attributeDefinitions.isDeleted, false),
                ),
            )
            .limit(1);

        const values = {
            ...definition,
            entityTypeName: sunflowerPackageEntityTypeName,
        };

        if (!existing) {
            await storage().insert(attributeDefinitions).values(values);
            continue;
        }

        await storage()
            .update(attributeDefinitions)
            .set(values)
            .where(eq(attributeDefinitions.id, existing.id));
    }
}

async function findPackageEntityId(
    codeDefinition: SelectAttributeDefinition,
    code: string,
) {
    const [existing] = await storage()
        .select({ id: entities.id })
        .from(entities)
        .innerJoin(attributeValues, eq(attributeValues.entityId, entities.id))
        .where(
            and(
                eq(entities.entityTypeName, sunflowerPackageEntityTypeName),
                eq(entities.isDeleted, false),
                eq(attributeValues.attributeDefinitionId, codeDefinition.id),
                eq(attributeValues.value, code),
                eq(attributeValues.isDeleted, false),
            ),
        )
        .limit(1);

    return existing?.id ?? null;
}

export async function seedSunflowerPackageCatalog() {
    const categoryId = await ensureEntityTypeCategory();
    await ensureEntityType(categoryId);
    await ensureAttributeCategories();
    await ensureAttributeDefinitions();

    const definitions = await getAttributeDefinitions(
        sunflowerPackageEntityTypeName,
    );
    const definitionsByPath = new Map(
        definitions.map((definition) => [
            attributePath(definition),
            definition,
        ]),
    );
    const codeDefinition = definitionsByPath.get('presentation.code');
    if (!codeDefinition) {
        throw new Error('Missing sunflower package code definition.');
    }

    const results: {
        code: string;
        entityId: number;
        created: boolean;
        changedValueCount: number;
    }[] = [];

    for (const spec of sunflowerPackageSeedSpecs) {
        let entityId = await findPackageEntityId(codeDefinition, spec.code);
        const created = entityId === null;
        if (!entityId) {
            entityId = await createEntity(
                sunflowerPackageEntityTypeName,
                seedActor,
            );
        }

        let changedValueCount = 0;
        for (const [path, value] of Object.entries(packageValues(spec))) {
            const definition = definitionsByPath.get(path);
            if (!definition) {
                throw new Error(`Missing sunflower package attribute ${path}.`);
            }
            const existingValue =
                await storage().query.attributeValues.findFirst({
                    where: and(
                        eq(attributeValues.entityId, entityId),
                        eq(
                            attributeValues.attributeDefinitionId,
                            definition.id,
                        ),
                        eq(attributeValues.isDeleted, false),
                    ),
                });
            if (existingValue?.value === value) {
                continue;
            }
            await upsertAttributeValue(
                {
                    id: existingValue?.id,
                    attributeDefinitionId: definition.id,
                    entityId,
                    entityTypeName: sunflowerPackageEntityTypeName,
                    order: definition.order,
                    value,
                },
                seedActor,
            );
            changedValueCount += 1;
        }

        await updateEntity(
            {
                id: entityId,
                state: 'published',
            },
            seedActor,
        );

        results.push({
            code: spec.code,
            entityId,
            created,
            changedValueCount,
        });
    }

    return results;
}

export async function getSunflowerPackages(options?: {
    includeInactive?: boolean;
}) {
    const packages = (
        await getEntitiesFormatted<FormattedSunflowerPackageEntity>(
            sunflowerPackageEntityTypeName,
        )
    )
        .map(normalizeSunflowerPackage)
        .filter((pkg) => options?.includeInactive || pkg.isActive)
        .sort(
            (left, right) =>
                left.displayOrder - right.displayOrder ||
                left.code.localeCompare(right.code),
        );

    const duplicateCodes = packages
        .map((pkg) => pkg.code)
        .filter((code, index, values) => values.indexOf(code) !== index);
    if (duplicateCodes.length > 0) {
        throw new Error(
            `Duplicate sunflower package codes: ${Array.from(new Set(duplicateCodes)).join(', ')}`,
        );
    }

    return packages;
}

export function getPublishedSunflowerPackages() {
    return getSunflowerPackages();
}

export async function getSunflowerPackageByCode(
    code: string,
    options?: { includeInactive?: boolean },
) {
    const packages = await getSunflowerPackages(options);
    return packages.find((pkg) => pkg.code === code) ?? null;
}

export async function getSunflowerPackageEligibilityForAccount(
    accountId: string,
) {
    const packages = await getSunflowerPackages();
    const purchasedOneTimeCodes = await Promise.all(
        packages
            .filter((pkg) => pkg.isOneTime && pkg.oneTimeScope === 'account')
            .map(async (pkg) => ({
                code: pkg.code,
                purchased: await hasPurchasedSunflowerPackage(
                    accountId,
                    pkg.code,
                ),
            })),
    );
    const purchasedByCode = new Map(
        purchasedOneTimeCodes.map((pkg) => [pkg.code, pkg.purchased]),
    );

    return packages.map((pkg) => {
        if (
            pkg.isOneTime &&
            pkg.oneTimeScope === 'account' &&
            purchasedByCode.get(pkg.code)
        ) {
            return {
                ...pkg,
                eligible: false,
                ineligibleReason: 'already_purchased' as const,
            };
        }
        return { ...pkg, eligible: true };
    });
}

export async function getSunflowerPackageAdminRows() {
    return storage()
        .select({
            id: entities.id,
            state: entities.state,
            updatedAt: entities.updatedAt,
        })
        .from(entities)
        .where(
            and(
                eq(entities.entityTypeName, sunflowerPackageEntityTypeName),
                eq(entities.isDeleted, false),
            ),
        )
        .orderBy(asc(entities.updatedAt), asc(entities.id));
}
