import { and, count, eq } from 'drizzle-orm';
import {
    attributeValues,
    closeStorage,
    entities,
    gardenBlocks,
    getAttributeDefinitions,
    imageAttributeValueFromUrl,
    type SelectAttributeDefinition,
    storage,
    updateEntity,
    upsertAttributeValue,
} from '../src';
import { createNamedEntity } from './lib/createNamedEntity';
import { renameBlockEntityAndPlacements } from './lib/renameBlockEntityAndPlacements';

// Deploy the runtime and public assets before using --apply. The default
// dry-run prevents catalog entries from pointing at models and covers that are
// not live yet.

const actor = {
    id: 'codex',
    name: 'Codex',
};

const entityTypeName = 'block';

type TerrainBlockSpec = {
    fullDescription: string;
    hitboxDepth?: number;
    hitboxWidth?: number;
    label: string;
    name: string;
    placeableOnWater?: boolean;
    previousName?: string;
    shortDescription: string;
};

function terrainBlockSpec({
    fullDescription,
    hitboxDepth = 1,
    hitboxWidth = 1,
    label,
    name,
    placeableOnWater = false,
    previousName,
    shortDescription,
}: TerrainBlockSpec) {
    return {
        name,
        previousName,
        attributes: {
            'attributes.height': '0.4',
            'attributes.hitboxDepth': hitboxDepth.toString(),
            'attributes.hitboxHeight': '0.4',
            'attributes.hitboxWidth': hitboxWidth.toString(),
            'attributes.nightOnlyPurchase': 'false',
            'attributes.placeableOnWater': placeableOnWater.toString(),
            'attributes.spanDepth': '1',
            'attributes.spanWidth': '1',
            'attributes.stackable': 'true',
            'attributes.type': 'decoration',
            'functions.raisedBed': 'false',
            'functions.recycler': 'false',
            'image.cover': imageAttributeValueFromUrl(
                `https://www.gredice.com/assets/blocks/${name}.webp`,
            ),
            'information.fullDescription': fullDescription,
            'information.label': label,
            'information.name': name,
            'information.shortDescription': shortDescription,
            'prices.sunflowers': '5',
        },
    };
}

const blockSpecs = [
    terrainBlockSpec({
        name: 'Block_Stone',
        label: 'Kamen',
        shortDescription:
            'Veliki kameni blok sa zakošenim bridovima za čvrste vrtne površine i zidove.',
        fullDescription:
            'Kamen je čvrsti blok sastavljen od velikih sivih kamenih ploha s blago zakošenim bridovima. Bez raslinja i drugih ukrasa pruža čist, masivan izgled za potporne zidove, povišene rubove i kamene dijelove vrta.',
    }),
    terrainBlockSpec({
        name: 'Block_Stone_Angle',
        label: 'Kamen rub',
        shortDescription:
            'Kosi kameni rub sa zakošenim bridovima za završetke kamenih površina.',
        fullDescription:
            'Kamen rub oblikuje postupan prijelaz s punog kamenog bloka prema nižoj površini. Velike sive kamene plohe, blago zakošeni bridovi i izostanak raslinja daju mu uredan i čvrst izgled na rubovima zidova, terasa i staza.',
    }),
    terrainBlockSpec({
        name: 'Block_Gravel',
        label: 'Šljunak',
        shortDescription:
            'Topli sivosmeđi šljunak sa sitnim kamenčićima i ravnim spojevima za povezane staze.',
        fullDescription:
            'Šljunak je topli sivosmeđi terenski blok prekriven sitnim kamenčićima različitih oblika. Ravni, nezakošeni bridovi spajaju susjedne blokove bez procjepa, a površina bez raslinja prikladna je za vrtne staze, prilaze i suhe prijelaze.',
    }),
    terrainBlockSpec({
        name: 'Block_Gravel_Angle',
        label: 'Šljunak rub',
        shortDescription:
            'Topli sivosmeđi šljunčani nagib s ravnim spojevima za rubove staza i nasipa.',
        fullDescription:
            'Šljunak rub spušta toplu sivosmeđu šljunčanu površinu prema nižem terenu. Nezakošeni bočni bridovi čisto se spajaju sa susjednim blokovima, dok sitni kamenčići bez raslinja oblikuju prirodne završetke staza, prilaza i manjih nasipa.',
    }),
    terrainBlockSpec({
        name: 'Block_Dry_Ground',
        label: 'Suha zemlja',
        shortDescription:
            'Svijetla suha zemlja bez raslinja za osunčane i ogoljene dijelove vrta.',
        fullDescription:
            'Suha zemlja je svjetlija varijanta zemljanog bloka s toplim, prašnjavim tonovima i bez raslinja. Prikladna je za osunčane površine, suhe prijelaze i dijelove vrta kojima treba ogoljen, ljetni izgled.',
    }),
    terrainBlockSpec({
        name: 'Block_Dry_Ground_Angle',
        label: 'Suha zemlja rub',
        shortDescription:
            'Kosi rub svijetle suhe zemlje za blage prijelaze između terenskih razina.',
        fullDescription:
            'Suha zemlja rub oblikuje blagi prijelaz sa svijetle, prašnjave površine prema nižem terenu. Bez raslinja zadržava ogoljen i suh izgled uz rubove osunčanih vrtnih zona.',
    }),
    terrainBlockSpec({
        name: 'Block_Swamp_Ground',
        label: 'Močvarna zemlja',
        shortDescription:
            'Smeđezelena vlažna zemlja sa svijetlosmeđim raslinjem za močvarne dijelove vrta.',
        fullDescription:
            'Močvarna zemlja spaja zemljane smeđe i prigušene zelene tonove vlažnog tla sa svijetlosmeđim busenima raslinja. Stvara mekan, zasićen izgled obala, plićaka i sjenovitih dijelova vrta uz močvarnu vodu.',
    }),
    terrainBlockSpec({
        name: 'Block_Swamp_Ground_Angle',
        label: 'Močvarna zemlja rub',
        shortDescription:
            'Kosi rub smeđezelene močvarne zemlje sa svijetlosmeđim raslinjem.',
        fullDescription:
            'Močvarna zemlja rub spušta smeđezeleno vlažno tlo prema nižoj površini. Svijetlosmeđe raslinje prati nagib i pomaže oblikovati prirodne obale, plićake i prijelaze uz močvarnu vodu.',
    }),
    terrainBlockSpec({
        name: 'Block_Swamp_Water',
        label: 'Močvarna voda',
        shortDescription:
            'Zelenkasta močvarna voda sa zelenim algama na mirnoj površini.',
        fullDescription:
            'Močvarna voda je zelenija i mutnija od obične vode, s mirnom površinom na kojoj plutaju nakupine zelenih algi. Koristi se za bare, močvarne kanale i vlažne vrtne kutke povezane s močvarnom zemljom.',
        placeableOnWater: true,
    }),
    terrainBlockSpec({
        name: 'Block_Stone_Stairs',
        label: 'Kamene stube',
        shortDescription:
            'Pune kamene stube s dvije razine za povezivanje nižih i viših površina.',
        fullDescription:
            'Kamene stube ispunjavaju cijeli blok i imaju dvije jasno oblikovane razine: srednju i gornju. Velike sive kamene plohe sa zakošenim bridovima stvaraju čvrst prijelaz između različitih visina vrta.',
    }),
    terrainBlockSpec({
        name: 'Block_Stone_Stairs_Corner',
        previousName: 'Block_Stone_Stairs_Half',
        label: 'Kutne kamene stube',
        shortDescription:
            'Kutne kamene stube s dvije razine za povezivanje stubišta pod pravim kutom.',
        fullDescription:
            'Kutne kamene stube zauzimaju cijeli blok i zadržavaju srednju i gornju razinu punih stuba. Njihov kutni oblik povezuje dvije okomite strane stubišta u uredan zavoj od velikih sivih kamenih ploha sa zakošenim bridovima.',
    }),
    terrainBlockSpec({
        name: 'Block_Polished_Stone',
        label: 'Polirani kamen',
        shortDescription:
            'Glatki kameni blok iz jednog komada za uredne vrtne površine i zidove.',
        fullDescription:
            'Polirani kamen je čvrsti blok iz jednog komada s glatkom, ujednačenom kamenom plohom i diskretno obrađenim bridovima. Bez fuga i raslinja pruža čist izgled za terase, potporne zidove i suvremene kamene dijelove vrta.',
    }),
    terrainBlockSpec({
        name: 'Block_Polished_Stone_Angle',
        label: 'Polirani kamen rub',
        shortDescription:
            'Kosi rub poliranog kamena iz jednog komada za glatke završetke kamenih površina.',
        fullDescription:
            'Polirani kamen rub oblikuje postupan prijelaz prema nižoj površini u jednoj glatkoj kamenoj plohi. Ujednačena obrada bez fuga i raslinja uredno završava terase, zidove i suvremene kamene staze.',
    }),
    terrainBlockSpec({
        name: 'Block_Polished_Stone_Stairs',
        label: 'Polirane kamene stube',
        shortDescription:
            'Pune stube od glatkog kamena iz jednog komada s dvije jasno oblikovane razine.',
        fullDescription:
            'Polirane kamene stube zauzimaju cijeli blok i u jednoj glatkoj kamenoj cjelini oblikuju srednju i gornju razinu. Čista površina bez fuga i raslinja povezuje različite visine terasa, zidova i staza.',
    }),
    terrainBlockSpec({
        name: 'Block_Polished_Stone_Stairs_Corner',
        label: 'Kutne polirane kamene stube',
        shortDescription:
            'Kutne stube od glatkog kamena iz jednog komada za zavoje pod pravim kutom.',
        fullDescription:
            'Kutne polirane kamene stube zauzimaju cijeli blok te srednjom i gornjom razinom povezuju dvije okomite strane stubišta. Izrađene su kao jedna glatka kamena cjelina bez fuga i raslinja za čiste zavoje terasa i staza.',
    }),
] satisfies Array<{
    name: string;
    previousName?: string;
    attributes: Record<string, string>;
}>;

function parseApplyFlag(argv: string[]) {
    for (const argument of argv) {
        if (argument !== '--' && argument !== '--apply') {
            throw new Error(`Unknown argument: ${argument}`);
        }
    }
    return argv.includes('--apply');
}

function attributePath(definition: SelectAttributeDefinition) {
    return `${definition.category}.${definition.name}`;
}

function orderedAttributeEntries(attributes: Record<string, string>) {
    return Object.entries(attributes).sort(([leftPath], [rightPath]) => {
        const leftIsName = leftPath === 'information.name';
        const rightIsName = rightPath === 'information.name';
        return Number(rightIsName) - Number(leftIsName);
    });
}

async function findBlockEntity(nameDefinitionId: number, blockName: string) {
    const matches = await storage()
        .select({
            id: entities.id,
            publishedAt: entities.publishedAt,
            state: entities.state,
        })
        .from(entities)
        .innerJoin(attributeValues, eq(attributeValues.entityId, entities.id))
        .where(
            and(
                eq(entities.entityTypeName, entityTypeName),
                eq(entities.isDeleted, false),
                eq(attributeValues.isDeleted, false),
                eq(attributeValues.attributeDefinitionId, nameDefinitionId),
                eq(attributeValues.value, blockName),
            ),
        )
        .limit(2);

    if (matches.length > 1) {
        throw new Error(
            `Multiple active block entities found for ${blockName}.`,
        );
    }

    return matches[0] ?? null;
}

async function getExistingAttributeValue({
    attributeDefinitionId,
    entityId,
}: {
    attributeDefinitionId: number;
    entityId: number;
}) {
    return storage().query.attributeValues.findFirst({
        where: and(
            eq(attributeValues.entityId, entityId),
            eq(attributeValues.attributeDefinitionId, attributeDefinitionId),
            eq(attributeValues.isDeleted, false),
        ),
    });
}

async function countGardenBlocksWithName(blockName: string) {
    const [result] = await storage()
        .select({ value: count() })
        .from(gardenBlocks)
        .where(eq(gardenBlocks.name, blockName));
    return result?.value ?? 0;
}

async function main() {
    const apply = parseApplyFlag(process.argv.slice(2));
    const definitions = await getAttributeDefinitions(entityTypeName);
    const definitionsByPath = new Map(
        definitions.map((definition) => [
            attributePath(definition),
            definition,
        ]),
    );
    const requiredPaths = new Set(
        blockSpecs.flatMap((spec) => Object.keys(spec.attributes)),
    );
    const missingDefinitions = Array.from(requiredPaths).filter(
        (path) => !definitionsByPath.has(path),
    );
    if (missingDefinitions.length > 0) {
        throw new Error(
            `Missing block attribute definitions: ${missingDefinitions.join(', ')}`,
        );
    }

    const nameDefinition = definitionsByPath.get('information.name');
    if (!nameDefinition) {
        throw new Error('Missing information.name definition.');
    }

    const summaries: Array<{
        name: string;
        entityId: number | null;
        action: 'create' | 'update' | 'unchanged';
        changedAttributes: string[];
        publish: boolean;
        rename: {
            catalogueNameChange: boolean;
            fromName: string;
            sourceEntityId: number | null;
            gardenBlocksToRename: number;
            renamedGardenBlocks: number;
        } | null;
    }> = [];

    for (const spec of blockSpecs) {
        const targetEntity = await findBlockEntity(
            nameDefinition.id,
            spec.name,
        );
        const previousEntity = spec.previousName
            ? await findBlockEntity(nameDefinition.id, spec.previousName)
            : null;
        if (targetEntity && previousEntity) {
            throw new Error(
                `Both ${spec.previousName} and ${spec.name} are active block entities. Resolve the duplicate before applying this catalogue migration.`,
            );
        }

        let entity = targetEntity ?? previousEntity;
        let entityId = entity?.id ?? null;
        const changedAttributes: string[] = [];
        const rename = spec.previousName
            ? {
                  catalogueNameChange: previousEntity !== null,
                  fromName: spec.previousName,
                  sourceEntityId: entityId,
                  gardenBlocksToRename: await countGardenBlocksWithName(
                      spec.previousName,
                  ),
                  renamedGardenBlocks: 0,
              }
            : null;

        if (entityId) {
            for (const [path, expectedValue] of Object.entries(
                spec.attributes,
            )) {
                const definition = definitionsByPath.get(path);
                if (!definition) {
                    continue;
                }
                const existingValue = await getExistingAttributeValue({
                    attributeDefinitionId: definition.id,
                    entityId,
                });
                if (existingValue?.value !== expectedValue) {
                    changedAttributes.push(path);
                }
            }
        } else {
            changedAttributes.push(...Object.keys(spec.attributes));
        }

        const publish =
            entity?.state !== 'published' || entity?.publishedAt === null;
        const action: 'create' | 'update' | 'unchanged' = !entity
            ? 'create'
            : changedAttributes.length > 0 ||
                publish ||
                (rename?.gardenBlocksToRename ?? 0) > 0
              ? 'update'
              : 'unchanged';
        const summary = {
            name: spec.name,
            entityId,
            action,
            changedAttributes,
            publish,
            rename,
        };
        summaries.push(summary);

        if (!apply) {
            continue;
        }

        if (!entityId) {
            entityId = await createNamedEntity({
                actor,
                entityTypeName,
                name: spec.name,
                nameDefinition,
            });
            summary.entityId = entityId;
            if (rename) {
                rename.sourceEntityId = entityId;
            }
        }

        if (rename) {
            const renameResult = await renameBlockEntityAndPlacements({
                actor,
                entityId,
                entityTypeName,
                fromName: rename.fromName,
                nameDefinition,
                toName: spec.name,
            });
            rename.renamedGardenBlocks = renameResult.renamedGardenBlocks;
            if (renameResult.renamedAttribute !== rename.catalogueNameChange) {
                throw new Error(
                    `Unexpected catalogue rename state for ${rename.fromName} on entity ${entityId.toString()}.`,
                );
            }
        }

        for (const [path, expectedValue] of orderedAttributeEntries(
            spec.attributes,
        )) {
            const definition = definitionsByPath.get(path);
            if (!definition) {
                throw new Error(`Missing ${path} while applying ${spec.name}.`);
            }
            const existingValue = await getExistingAttributeValue({
                attributeDefinitionId: definition.id,
                entityId,
            });
            if (existingValue?.value === expectedValue) {
                continue;
            }
            await upsertAttributeValue(
                {
                    id: existingValue?.id,
                    attributeDefinitionId: definition.id,
                    entityId,
                    entityTypeName,
                    order: definition.order,
                    value: expectedValue,
                },
                actor,
            );
        }

        if (publish) {
            await updateEntity({ id: entityId, state: 'published' }, actor);
        }

        entity = await findBlockEntity(nameDefinition.id, spec.name);
        if (
            !entity ||
            entity.id !== entityId ||
            entity.state !== 'published' ||
            entity.publishedAt === null
        ) {
            throw new Error(`Failed to publish ${spec.name} block entity.`);
        }

        if (rename) {
            const legacyEntity = await findBlockEntity(
                nameDefinition.id,
                rename.fromName,
            );
            if (legacyEntity) {
                throw new Error(
                    `Legacy block name ${rename.fromName} is still active on entity ${legacyEntity.id.toString()}.`,
                );
            }
            if (
                rename.sourceEntityId === null ||
                entity.id !== rename.sourceEntityId
            ) {
                throw new Error(
                    `Block rename changed entity ID from ${rename.sourceEntityId?.toString() ?? 'missing'} to ${entity.id.toString()}.`,
                );
            }
            const remainingLegacyPlacements = await countGardenBlocksWithName(
                rename.fromName,
            );
            if (remainingLegacyPlacements !== 0) {
                throw new Error(
                    `${remainingLegacyPlacements.toString()} placed blocks still use ${rename.fromName}.`,
                );
            }
        }

        for (const [path, expectedValue] of Object.entries(spec.attributes)) {
            const definition = definitionsByPath.get(path);
            if (!definition) {
                throw new Error(
                    `Missing ${path} while verifying ${spec.name}.`,
                );
            }
            const storedValue = await getExistingAttributeValue({
                attributeDefinitionId: definition.id,
                entityId,
            });
            if (storedValue?.value !== expectedValue) {
                throw new Error(
                    `Unexpected ${path} for ${spec.name}: ${storedValue?.value ?? 'missing'}`,
                );
            }
        }
    }

    console.log(
        JSON.stringify(
            {
                mode: apply ? 'apply' : 'dry-run',
                blocks: summaries,
            },
            null,
            2,
        ),
    );
}

main()
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeStorage();
    });
