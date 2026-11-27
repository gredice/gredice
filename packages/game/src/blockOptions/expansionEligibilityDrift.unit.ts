import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    type GardenBlockExpansionEligibility,
    gardenAnimalBlockNames,
    getGardenBlockExpansionEligibility,
} from '@gredice/js/gardenBlockExpansion';
import { Vector3 } from 'three';
import { createHedgehogHabitats } from '../entities/hedgehogs/hedgehogHabitat';
import { persistentPetHomeSpecs } from '../entities/persistentPets/persistentPetHomes';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import { faunaFamilyRequirements } from '../scene/resources/gardenSceneManifest';
import type { Stack } from '../types/Stack';

// Drift guard for Expand (spec §7.1). `@gredice/js` decides which blocks can
// be expanded but cannot import the game, so its animal list could miss a new
// animal home. Every block that spawns an animal of its own must stay
// ineligible, or a 10 × 10 Expand would spawn up to 99 animals.

/**
 * A one-cell block, so only the name-based rules can refuse it: an animal
 * home that is ineligible only because it is multi-cell today would become
 * expandable the moment its footprint changed.
 */
const oneCellBlockData = { attributes: { spanWidth: 1, spanDepth: 1 } };

/** Fauna families whose habitat blocks are homes: one animal per block. */
const perHomeFaunaFamilies = new Set([
    'fauna:cats',
    'fauna:dogs',
    'fauna:chickens',
    'fauna:piglets',
    'fauna:goats',
    'fauna:sheep',
    'fauna:rabbits',
    'fauna:horses',
    'fauna:cows',
]);

function eligibilityOf(blockName: string): GardenBlockExpansionEligibility {
    return getGardenBlockExpansionEligibility({
        blockName,
        blockData: oneCellBlockData,
        rotation: 0,
    });
}

function assertNotExpandable(blockName: string, source: string) {
    const eligibility = eligibilityOf(blockName);
    assert.equal(
        eligibility.eligible,
        false,
        `${blockName} (${source}) spawns an animal but can be expanded. Add it to gardenAnimalBlockNames in packages/js/src/gardenBlockExpansion/index.ts.`,
    );
}

describe('Expand eligibility drift guard', () => {
    it('refuses every persistent pet home', () => {
        const homes = Object.keys(persistentPetHomeSpecs);
        assert.ok(homes.length > 0);
        for (const name of homes) {
            assertNotExpandable(name, 'persistentPetHomeSpecs');
            assert.ok(gardenAnimalBlockNames.has(name), name);
        }
    });

    it('refuses every habitat of the per-home fauna families', () => {
        const families = faunaFamilyRequirements.filter((requirement) =>
            perHomeFaunaFamilies.has(requirement.family),
        );
        assert.equal(families.length, perHomeFaunaFamilies.size);
        for (const requirement of families) {
            for (const name of requirement.habitats) {
                assertNotExpandable(name, requirement.family);
            }
        }
    });

    it('refuses bird houses, the home of the shared bird family', () => {
        const birds = faunaFamilyRequirements.find(
            (requirement) => requirement.family === 'fauna:birds',
        );
        assert.ok(birds?.habitats.includes('BirdHouse'));
        assertNotExpandable('BirdHouse', 'fauna:birds home');
    });

    it('refuses every block the hedgehog resolver treats as a shelter', () => {
        const blockData = getLocalSandboxBlockData();
        const shelters: string[] = [];
        for (const data of blockData) {
            const name = data.information.name;
            // A home on a grass patch with room around it for visits.
            const stacks: Stack[] = [];
            for (let z = -3; z <= 3; z++) {
                for (let x = -3; x <= 3; x++) {
                    stacks.push({
                        position: new Vector3(x, 0, z),
                        blocks: [
                            {
                                id: `ground:${x}:${z}`,
                                name: 'Block_Grass',
                                rotation: 0,
                            },
                            ...(x === 0 && z === 0
                                ? [{ id: 'home', name, rotation: 0 }]
                                : []),
                        ],
                    });
                }
            }

            const habitats = createHedgehogHabitats({
                stacks,
                blockData,
                gardenSeed: 'drift',
            });
            if (habitats.length > 0) {
                shelters.push(name);
            }
        }

        assert.deepEqual(shelters, ['HedgehogShelter']);
        for (const name of shelters) {
            assertNotExpandable(name, 'hedgehog habitat');
        }
    });

    it('still lets ordinary one-cell blocks expand', () => {
        for (const name of ['Block_Grass', 'Bush', 'Tulip', 'BeachBall']) {
            assert.deepEqual(eligibilityOf(name), { eligible: true }, name);
        }
    });
});
