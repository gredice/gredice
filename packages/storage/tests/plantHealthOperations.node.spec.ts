import assert from 'node:assert/strict';
import test from 'node:test';
import {
    plantHealthMaintenanceStage,
    plantHealthOperationApplicabilityUpdates,
    plantHealthOperationCopyUpdates,
    plantHealthOperationSpecs,
} from '../src/data/plantHealthOperations';

test('plant health operation specs keep the reviewed CMS contract', () => {
    assert.deepEqual(
        plantHealthOperationSpecs.map(
            ({
                name,
                label,
                application,
                appliesToAllTargets,
                internal,
                pricePerOperation,
                coverUrl,
                visualReward,
            }) => ({
                name,
                label,
                application,
                appliesToAllTargets,
                internal,
                pricePerOperation,
                coverUrl,
                visualReward: visualReward ?? null,
            }),
        ),
        [
            {
                name: 'sanitizeSeedlingGrowingArea',
                label: 'Sanacija prostora za uzgoj presadnica',
                application: 'plant',
                appliesToAllTargets: true,
                internal: true,
                pricePerOperation: 0.2,
                coverUrl:
                    'https://www.gredice.com/assets/operation-icons/plantPhoto.webp',
                visualReward: null,
            },
            {
                name: 'inspectAndManuallyRemovePests',
                label: 'Pregled i ručno uklanjanje štetnika',
                application: 'plant',
                appliesToAllTargets: true,
                internal: false,
                pricePerOperation: 0.4,
                coverUrl:
                    'https://www.gredice.com/assets/operation-icons/hygiene-pruning.webp',
                visualReward: null,
            },
            {
                name: 'installInsectProtectionMesh',
                label: 'Postavljanje zaštitne mreže protiv kukaca',
                application: 'raisedBedFull',
                appliesToAllTargets: false,
                internal: false,
                pricePerOperation: 2.99,
                coverUrl:
                    'https://www.gredice.com/assets/operation-icons/setAgrotextileWhite.webp',
                visualReward: 'insectMesh',
            },
            {
                name: 'removeInsectProtectionMesh',
                label: 'Uklanjanje zaštitne mreže protiv kukaca',
                application: 'raisedBedFull',
                appliesToAllTargets: false,
                internal: false,
                pricePerOperation: 0.2,
                coverUrl:
                    'https://www.gredice.com/assets/operation-icons/removeAgrotextileWhite.webp',
                visualReward: 'removeInsectMesh',
            },
        ],
    );

    assert.deepEqual(plantHealthMaintenanceStage, {
        id: 306,
        name: 'maintenance',
    });
    assert.equal(
        new Set(plantHealthOperationSpecs.map((spec) => spec.name)).size,
        plantHealthOperationSpecs.length,
    );

    for (const spec of plantHealthOperationSpecs) {
        assert.equal(spec.stageId, plantHealthMaintenanceStage.id);
        assert.equal(spec.frequency, 'optional');
        assert.equal(spec.deliverable, false);
        assert.equal(spec.printLabel, false);
        assert.ok(spec.shortDescription.length >= 80, spec.name);
        assert.ok(spec.description.length >= 300, spec.name);
        assert.ok(spec.instructions.length >= 400, spec.name);
        assert.match(spec.instructions, /^1\./, spec.name);

        const copy = `${spec.description}\n${spec.instructions}`;
        assert.doesNotMatch(
            copy,
            /\b(?:pesticid|insekticid|fungicid|herbicid|biopesticid|neem)\b/i,
            spec.name,
        );
    }
});

test('operation copy captures the reviewed non-chemical controls', () => {
    const sanitation = plantHealthOperationSpecs.find(
        (spec) => spec.name === 'sanitizeSeedlingGrowingArea',
    );
    assert.ok(sanitation);
    const sanitationCopy = `${sanitation.description}\n${sanitation.instructions}`;
    assert.match(sanitationCopy, /polijeganj/i);
    assert.match(sanitationCopy, /zatvoren/i);
    assert.match(sanitationCopy, /stajaću vodu/i);

    const manualRemoval = plantHealthOperationSpecs.find(
        (spec) => spec.name === 'inspectAndManuallyRemovePests',
    );
    assert.ok(manualRemoval);
    const manualRemovalCopy = `${manualRemoval.description}\n${manualRemoval.instructions}`;
    for (const expectedTerm of [
        /gusjenic/i,
        /kornjaš/i,
        /ličink/i,
        /jajaš/i,
        /pužev/i,
        /golać/i,
        /kućic/i,
        /korisn/i,
    ]) {
        assert.match(manualRemovalCopy, expectedTerm);
    }
    assert.match(manualRemovalCopy, /ne uklanjati oprašivače/i);

    const mesh = plantHealthOperationSpecs.find(
        (spec) => spec.name === 'installInsectProtectionMesh',
    );
    assert.ok(mesh);
    const meshCopy = `${mesh.description}\n${mesh.instructions}`;
    assert.match(meshCopy, /veličin[ae] oka/i);
    assert.match(meshCopy, /svi rubovi zatvoreni/i);
    assert.match(meshCopy, /oprašivač/i);
    assert.match(meshCopy, /prozračivanj/i);

    const meshRemoval = plantHealthOperationSpecs.find(
        (spec) => spec.name === 'removeInsectProtectionMesh',
    );
    assert.ok(meshRemoval);
    const meshRemovalCopy = `${meshRemoval.description}\n${meshRemoval.instructions}`;
    assert.match(meshRemovalCopy, /završilo razdoblje zaštite/i);
    assert.match(meshRemovalCopy, /Kratkotrajno podizanje/i);
    assert.match(meshRemovalCopy, /više neće ostati na gredici/i);
    assert.match(meshRemovalCopy, /potpuno osušiti/i);
    assert.equal(mesh.visualReward, 'insectMesh');
    assert.equal(meshRemoval.visualReward, 'removeInsectMesh');
});

test('guarded updates change only the reviewed operation identities', () => {
    assert.deepEqual(
        plantHealthOperationCopyUpdates.map(({ entityId, name }) => ({
            entityId,
            name,
        })),
        [
            { entityId: 319, name: 'hygiene-pruning' },
            { entityId: 346, name: 'plantRemoval' },
        ],
    );
    assert.deepEqual(plantHealthOperationApplicabilityUpdates, [
        { entityId: 319, name: 'hygiene-pruning' },
        { entityId: 583, name: 'rinsePestsFromPlant' },
    ]);

    const hygienePruning = plantHealthOperationCopyUpdates.find(
        (update) => update.entityId === 319,
    );
    assert.ok(hygienePruning);
    const hygieneCopy = `${hygienePruning.description}\n${hygienePruning.instructions}`;
    assert.match(hygieneCopy, /zatvoren/i);
    assert.match(hygieneCopy, /ne kompostira/i);
    assert.match(hygieneCopy, /ne kompostirati/i);
    assert.doesNotMatch(hygieneCopy, /zaštitn\w* sredstv/i);

    const plantRemoval = plantHealthOperationCopyUpdates.find(
        (update) => update.entityId === 346,
    );
    assert.ok(plantRemoval);
    const removalCopy = `${plantRemoval.description}\n${plantRemoval.instructions}`;
    assert.match(removalCopy, /Zdravi ostaci/i);
    assert.match(removalCopy, /kompostište OPG-a/i);
    assert.match(removalCopy, /Sumnjivi ili zahvaćeni materijal/i);
    assert.match(removalCopy, /ne kompostirati ga niti spaljivati automatski/i);

    assert.ok(
        plantHealthOperationApplicabilityUpdates.every(
            (update) => !update.name.startsWith('apply'),
        ),
    );
});
