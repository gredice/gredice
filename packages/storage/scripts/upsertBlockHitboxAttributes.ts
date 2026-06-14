import { and, eq, inArray } from 'drizzle-orm';
import {
    bustCached,
    bustCachedByPrefixes,
    cacheKeys,
} from '../src/cache/directoriesCached';
import {
    attributeDefinitions,
    attributeValues,
    entities,
    entityRevisions,
} from '../src/schema/cmsSchema';
import { closeStorage, storage } from '../src/storage';

const actor = {
    id: 'codex',
    name: 'Codex',
};

type HitboxSize = {
    width: number;
    height: number;
    depth: number;
};

const cell = (height: number): HitboxSize => ({
    width: 1,
    height,
    depth: 1,
});

const blockHitboxes = {
    BaleHey: { width: 0.44, height: 0.36, depth: 0.82 },
    BirdHouse: { width: 0.72, height: 1.3, depth: 0.72 },
    Block_Grass: cell(0.4),
    Block_Grass_Angle: cell(0.4),
    Block_Grass_Corner: cell(0.4),
    Block_Grass_Reverse_Corner: cell(0.4),
    Block_Ground: cell(0.4),
    Block_Ground_Angle: cell(0.4),
    Block_Ground_Corner: cell(0.4),
    Block_Ground_Reverse_Corner: cell(0.4),
    Block_Sand: cell(0.4),
    Block_Sand_Angle: cell(0.4),
    Block_Sand_Corner: cell(0.4),
    Block_Sand_Reverse_Corner: cell(0.4),
    Block_Snow: cell(0.4),
    Block_Snow_Angle: cell(0.4),
    Block_Snow_Corner: cell(0.4),
    Block_Snow_Falling: cell(0.4),
    Block_Snow_Reverse_Corner: cell(0.4),
    Block_Water: cell(0.4),
    Bucket: { width: 0.45, height: 0.5, depth: 0.45 },
    Bush: { width: 0.72, height: 0.5, depth: 0.72 },
    CactusBarrel: { width: 0.78, height: 0.6, depth: 0.78 },
    CactusColumnCluster: { width: 0.72, height: 1, depth: 0.62 },
    CactusPricklyPear: { width: 0.66, height: 0.95, depth: 0.45 },
    CatPillow: { width: 0.95, height: 0.25, depth: 0.68 },
    Composter: { width: 0.82, height: 0.63, depth: 0.82 },
    DeadTreeStump: { width: 0.45, height: 0.98, depth: 0.75 },
    DeadTreeTall: { width: 1.4, height: 1.8, depth: 0.52 },
    DesertStoneLarge: { width: 0.82, height: 0.63, depth: 0.56 },
    DesertStoneMedium: { width: 0.66, height: 0.33, depth: 0.45 },
    DesertStoneSmall: { width: 0.43, height: 0.2, depth: 0.31 },
    DogHouse: { width: 0.78, height: 0.72, depth: 0.86 },
    Fence: cell(0.58),
    FireflyJar: { width: 0.5, height: 0.65, depth: 0.5 },
    GardenBox: { width: 0.96, height: 0.78, depth: 0.8 },
    GiftBox_BlueWhite: { width: 0.6, height: 0.62, depth: 0.6 },
    GiftBox_GoldRed: { width: 0.6, height: 0.62, depth: 0.6 },
    GiftBox_GreenGold: { width: 0.6, height: 0.62, depth: 0.6 },
    GiftBox_PurpleSilver: { width: 0.6, height: 0.62, depth: 0.6 },
    GiftBox_RedWhite: { width: 0.6, height: 0.62, depth: 0.6 },
    GiftBox_WhiteGreen: { width: 0.6, height: 0.62, depth: 0.6 },
    MulchCoconut: { width: 0.96, height: 0.08, depth: 0.96 },
    MulchHey: { width: 0.96, height: 0.08, depth: 0.96 },
    MulchWood: { width: 0.96, height: 0.08, depth: 0.96 },
    Pine: { width: 1.12, height: 2.77, depth: 1.12 },
    PineAdvent: { width: 1.12, height: 2.77, depth: 1.12 },
    PotBulbousNeck: { width: 0.56, height: 0.47, depth: 0.56 },
    PotHourglass: { width: 0.52, height: 0.43, depth: 0.5 },
    PotLowBowl: { width: 0.58, height: 0.22, depth: 0.58 },
    PotNarrowFootBowl: { width: 0.6, height: 0.35, depth: 0.6 },
    PotRoundedBowl: { width: 0.48, height: 0.39, depth: 0.48 },
    PotSquatRidged: { width: 0.53, height: 0.38, depth: 0.53 },
    PotStraightShortTub: { width: 0.45, height: 0.36, depth: 0.45 },
    PotTallSlenderCone: { width: 0.47, height: 0.58, depth: 0.45 },
    PotTallTapered: { width: 0.5, height: 0.5, depth: 0.48 },
    PotWideLippedCup: { width: 0.66, height: 0.45, depth: 0.66 },
    Raised_Bed: cell(0.35),
    Shade: cell(1.05),
    ShovelSmall: { width: 0.32, height: 1.03, depth: 0.16 },
    Snowman: { width: 0.42, height: 0.5, depth: 0.42 },
    StoneLarge: { width: 0.32, height: 0.28, depth: 0.35 },
    StoneMedium: { width: 0.24, height: 0.14, depth: 0.22 },
    StoneSmall: { width: 0.18, height: 0.08, depth: 0.18 },
    Stool: { width: 0.82, height: 0.48, depth: 0.82 },
    Tree: { width: 1.36, height: 2.38, depth: 1.43 },
    Tulip: { width: 0.24, height: 0.4, depth: 0.24 },
    WaterWell: { width: 1.22, height: 1.36, depth: 0.95 },
    WateringCan: { width: 1, height: 0.56, depth: 0.45 },
} satisfies Record<string, HitboxSize>;

const shapedTerrainVisualHeights = {
    Block_Grass_Angle: 0.4,
    Block_Grass_Corner: 0.4,
    Block_Grass_Reverse_Corner: 0.4,
    Block_Ground_Angle: 0.4,
    Block_Ground_Corner: 0.4,
    Block_Ground_Reverse_Corner: 0.4,
    Block_Sand_Angle: 0.4,
    Block_Sand_Corner: 0.4,
    Block_Sand_Reverse_Corner: 0.4,
} satisfies Record<string, number>;

const hitboxDefinitionSpecs = [
    {
        name: 'hitboxWidth',
        label: 'Širina hitboxa',
        description:
            'Širina nevidljive zone za odabir i povlačenje bloka u vrtu.',
        defaultValue: '1',
        value: (hitbox: HitboxSize) => hitbox.width,
    },
    {
        name: 'hitboxHeight',
        label: 'Visina hitboxa',
        description:
            'Visina nevidljive zone za odabir i povlačenje bloka u vrtu.',
        defaultValue: null,
        value: (hitbox: HitboxSize) => hitbox.height,
    },
    {
        name: 'hitboxDepth',
        label: 'Dubina hitboxa',
        description:
            'Dubina nevidljive zone za odabir i povlačenje bloka u vrtu.',
        defaultValue: '1',
        value: (hitbox: HitboxSize) => hitbox.depth,
    },
] as const;

async function upsertHitboxDefinition(
    spec: (typeof hitboxDefinitionSpecs)[number],
) {
    const [existingDefinition] = await storage()
        .select()
        .from(attributeDefinitions)
        .where(
            and(
                eq(attributeDefinitions.entityTypeName, 'block'),
                eq(attributeDefinitions.category, 'attributes'),
                eq(attributeDefinitions.name, spec.name),
                eq(attributeDefinitions.isDeleted, false),
            ),
        );

    const definitionValues = {
        category: 'attributes',
        name: spec.name,
        label: spec.label,
        description: spec.description,
        entityTypeName: 'block',
        dataType: 'number',
        defaultValue: spec.defaultValue,
        required: false,
        display: false,
    };

    if (!existingDefinition) {
        const [created] = await storage()
            .insert(attributeDefinitions)
            .values(definitionValues)
            .returning({ id: attributeDefinitions.id });
        return created.id;
    }

    await storage()
        .update(attributeDefinitions)
        .set(definitionValues)
        .where(eq(attributeDefinitions.id, existingDefinition.id));
    return existingDefinition.id;
}

async function getPublishedBlockIdsByName() {
    const blockNameDefinition =
        await storage().query.attributeDefinitions.findFirst({
            where: and(
                eq(attributeDefinitions.entityTypeName, 'block'),
                eq(attributeDefinitions.category, 'information'),
                eq(attributeDefinitions.name, 'name'),
                eq(attributeDefinitions.isDeleted, false),
            ),
        });

    if (!blockNameDefinition) {
        throw new Error('Missing block information.name definition.');
    }

    const blockNames = Array.from(
        new Set([
            ...Object.keys(blockHitboxes),
            ...Object.keys(shapedTerrainVisualHeights),
        ]),
    );
    const rows = await storage()
        .select({
            entityId: entities.id,
            name: attributeValues.value,
        })
        .from(entities)
        .innerJoin(attributeValues, eq(attributeValues.entityId, entities.id))
        .where(
            and(
                eq(entities.entityTypeName, 'block'),
                eq(entities.state, 'published'),
                eq(entities.isDeleted, false),
                eq(attributeValues.isDeleted, false),
                eq(
                    attributeValues.attributeDefinitionId,
                    blockNameDefinition.id,
                ),
                inArray(attributeValues.value, blockNames),
            ),
        );

    return new Map(
        rows.map((row) => {
            if (!row.name) {
                throw new Error(`Block entity ${row.entityId} has no name.`);
            }
            return [row.name, row.entityId] as const;
        }),
    );
}

async function getRequiredBlockAttributeDefinitionId({
    category,
    name,
}: {
    category: string;
    name: string;
}) {
    const definition = await storage().query.attributeDefinitions.findFirst({
        where: and(
            eq(attributeDefinitions.entityTypeName, 'block'),
            eq(attributeDefinitions.category, category),
            eq(attributeDefinitions.name, name),
            eq(attributeDefinitions.isDeleted, false),
        ),
    });

    if (!definition) {
        throw new Error(`Missing block ${category}.${name} definition.`);
    }

    return definition.id;
}

async function upsertBlockAttributeValue({
    attributeDefinitionId,
    entityId,
    nextValue,
}: {
    attributeDefinitionId: number;
    entityId: number;
    nextValue: string;
}) {
    const [existingValue] = await storage()
        .select()
        .from(attributeValues)
        .where(
            and(
                eq(attributeValues.entityId, entityId),
                eq(
                    attributeValues.attributeDefinitionId,
                    attributeDefinitionId,
                ),
                eq(attributeValues.isDeleted, false),
            ),
        );

    if (existingValue?.value === nextValue) {
        return false;
    }

    if (existingValue) {
        await storage()
            .update(attributeValues)
            .set({ value: nextValue })
            .where(eq(attributeValues.id, existingValue.id));
        await storage().insert(entityRevisions).values({
            entityId,
            entityTypeName: 'block',
            action: 'attribute.updated',
            actorId: actor.id,
            actorName: actor.name,
            attributeValueId: existingValue.id,
            attributeDefinitionId,
            previousValue: existingValue.value,
            nextValue,
        });
        return true;
    }

    const [createdValue] = await storage()
        .insert(attributeValues)
        .values({
            entityId,
            entityTypeName: 'block',
            attributeDefinitionId,
            value: nextValue,
        })
        .returning({ id: attributeValues.id });
    await storage().insert(entityRevisions).values({
        entityId,
        entityTypeName: 'block',
        action: 'attribute.created',
        actorId: actor.id,
        actorName: actor.name,
        attributeValueId: createdValue.id,
        attributeDefinitionId,
        previousValue: null,
        nextValue,
    });
    return true;
}

async function main() {
    const definitionIds = new Map<string, number>();
    for (const spec of hitboxDefinitionSpecs) {
        definitionIds.set(spec.name, await upsertHitboxDefinition(spec));
    }

    const blockIdsByName = await getPublishedBlockIdsByName();
    const missingBlockNames = Object.keys(blockHitboxes).filter(
        (name) => !blockIdsByName.has(name),
    );
    if (missingBlockNames.length > 0) {
        throw new Error(
            `Missing published block entities: ${missingBlockNames.join(', ')}`,
        );
    }

    const changedEntityIds = new Set<number>();
    let changedValueCount = 0;
    for (const [blockName, hitbox] of Object.entries(blockHitboxes)) {
        const entityId = blockIdsByName.get(blockName);
        if (!entityId) {
            continue;
        }

        for (const spec of hitboxDefinitionSpecs) {
            const attributeDefinitionId = definitionIds.get(spec.name);
            if (!attributeDefinitionId) {
                throw new Error(`Missing definition id for ${spec.name}.`);
            }
            const changed = await upsertBlockAttributeValue({
                attributeDefinitionId,
                entityId,
                nextValue: String(spec.value(hitbox)),
            });
            if (changed) {
                changedEntityIds.add(entityId);
                changedValueCount += 1;
            }
        }
    }

    const heightDefinitionId = await getRequiredBlockAttributeDefinitionId({
        category: 'attributes',
        name: 'height',
    });
    let changedVisualHeightCount = 0;
    for (const [blockName, height] of Object.entries(
        shapedTerrainVisualHeights,
    )) {
        const entityId = blockIdsByName.get(blockName);
        if (!entityId) {
            continue;
        }

        const changed = await upsertBlockAttributeValue({
            attributeDefinitionId: heightDefinitionId,
            entityId,
            nextValue: String(height),
        });
        if (changed) {
            changedEntityIds.add(entityId);
            changedVisualHeightCount += 1;
        }
    }

    await Promise.all([
        bustCached(cacheKeys.entityTypeName('block')),
        bustCachedByPrefixes(['entities:formatted:', 'dashboard:admin:']),
        ...Array.from(changedEntityIds).map((entityId) =>
            bustCached(cacheKeys.entity(entityId)),
        ),
    ]);

    console.log(
        `Upserted ${hitboxDefinitionSpecs.length} definitions, ${changedValueCount} block hitbox values, and ${changedVisualHeightCount} shaped terrain visual heights across ${changedEntityIds.size} changed entities.`,
    );
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeStorage();
    });
