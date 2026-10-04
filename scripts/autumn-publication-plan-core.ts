import {
    getAutumnStarterPackVersion,
    prepareAutumnStarterPacks,
} from '../apps/api/lib/garden/autumnStarterPackPreparation';
import { gameAssetModels } from '../packages/game/src/data/gameAssetModels.generated';
import { gardenPackProductSnapshotSchema } from '../packages/storage/src/gardenPackContract';
import {
    assertReviewedPublicationEntity,
    publicationAttributeMap,
    publicationContent,
    publicationDigest,
    publicationEntityDigest,
    sortedDefinitions,
    validateAutumnPublicationPlan,
    validatePublicationExport,
} from '../packages/storage/src/helpers/autumnPublicationPlan';
import { imageAttributeValueFromUrl } from '../packages/storage/src/helpers/generatedAttributeValues';
import {
    type inspectAutumnSource,
    inspectDirectory,
    inspectLegacyDirectory,
} from './autumn-release-preflight-core';

type Source = Awaited<ReturnType<typeof inspectAutumnSource>>;
export function reviewedPublicationAttributes(item: Source['items'][number]) {
    const attributes: Record<string, string> = {
        'information.name': item.name,
        'functions.raisedBed': 'false',
        'functions.recycler': 'false',
        'image.cover': imageAttributeValueFromUrl(
            new URL(item.cover, 'https://www.gredice.com').href,
        ),
    };
    for (const [key, value] of Object.entries(item.information)) {
        if (typeof value !== 'string')
            throw new Error(`Invalid reviewed information: ${item.name}`);
        attributes[`information.${key}`] = value;
    }
    for (const [key, value] of Object.entries(item.attributes)) {
        if (!['string', 'boolean', 'number'].includes(typeof value))
            throw new Error(`Invalid reviewed attribute: ${item.name}`);
        attributes[`attributes.${key}`] = String(value);
    }
    return attributes;
}
export function reviewedDeployedAssets(source: Source) {
    const publicAssets = source.files.filter(
        (file) =>
            file.path.startsWith('apps/garden/public/assets/') ||
            file.path.startsWith('apps/www/public/assets/'),
    );
    return publicAssets.map((file) => {
        const garden = file.path.startsWith('apps/garden/public/');
        const pathname = file.path.replace(
            garden ? 'apps/garden/public' : 'apps/www/public',
            '',
        );
        let url = new URL(
            pathname,
            garden ? 'https://vrt.gredice.com' : 'https://www.gredice.com',
        ).href;
        if (pathname.startsWith('/assets/models/')) {
            const model = Object.values(gameAssetModels).find(
                (model) =>
                    new URL(model.url, 'https://vrt.gredice.com').pathname ===
                    pathname,
            );
            if (!model)
                throw new Error(`Unregistered deployed model: ${pathname}`);
            url = new URL(model.url, 'https://vrt.gredice.com').href;
        }
        return { ...file, url };
    });
}
export function createAutumnPublicationPlan(source: Source, cmsInput: unknown) {
    if (source.blockers.length || !source.reviewedEvidence)
        throw new Error('Reviewed source preflight is blocked');
    const cms = validatePublicationExport(cmsInput);
    const operations = [...source.items]
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .map((item) => {
            const expected = cms.entities.find(
                (entity) =>
                    publicationAttributeMap(entity, cms.definitions).get(
                        'information.name',
                    ) === item.name,
            );
            if (!expected)
                throw new Error(
                    `Missing actual CMS draft/published identity: ${item.name}`,
                );
            const reviewedAttributes = reviewedPublicationAttributes(item);
            const actualPrice = assertReviewedPublicationEntity(
                expected,
                cms.definitions,
                reviewedAttributes,
            );
            return {
                name: item.name,
                expected,
                expectedDigest: publicationEntityDigest(expected),
                contentDigest: publicationDigest(publicationContent(expected)),
                reviewedAttributes,
                actualPrice,
                action:
                    expected.state === 'published'
                        ? ('noop' as const)
                        : ('publish' as const),
            };
        });
    return validateAutumnPublicationPlan({
        schemaVersion: 1,
        scope: 'autumn-ab-pilot',
        sourceFingerprint: source.sourceFingerprint,
        definitions: sortedDefinitions(cms.definitions),
        definitionsDigest: publicationDigest(
            sortedDefinitions(cms.definitions),
        ),
        operations,
        deployedAssets: reviewedDeployedAssets(source),
    });
}

/** Rebuild all reviewed fields/assets from current source; self-consistent JSON is insufficient. */
export function assertAuthoritativeAutumnPublicationPlan(
    source: Source,
    input: unknown,
) {
    const supplied = validateAutumnPublicationPlan(input);
    const authoritative = createAutumnPublicationPlan(source, {
        schemaVersion: 1,
        definitions: supplied.definitions,
        entities: supplied.operations.map((operation) => operation.expected),
    });
    if (publicationDigest(authoritative) !== publicationDigest(supplied))
        throw new Error(
            'Publication plan differs from current authoritative reviewed source/assets',
        );
    return authoritative;
}

/** Candidates only from actual published identities/prices, never projected draft rows. */
export function createAutumnPublishedPackCandidates(
    source: Source,
    publishedInput: unknown,
    windowInput: unknown,
) {
    if (source.blockers.length || !source.reviewedEvidence)
        throw new Error('Reviewed source preflight is blocked');
    const directory = inspectDirectory(publishedInput, source.items);
    const legacy = inspectLegacyDirectory(directory.rows);
    if (directory.blockers.length || legacy.blockers.length)
        throw new Error(
            [...directory.blockers, ...legacy.blockers]
                .map((blocker) => `${blocker.subject}: ${blocker.code}`)
                .join('; '),
        );
    if (
        windowInput === null ||
        typeof windowInput !== 'object' ||
        Array.isArray(windowInput) ||
        Object.keys(windowInput).sort().join('|') !==
            'availableFrom|availableUntil' ||
        !('availableFrom' in windowInput) ||
        !('availableUntil' in windowInput)
    )
        throw new Error(
            'Explicit immutable availability window (including explicit nulls) required',
        );
    const prepared = prepareAutumnStarterPacks(
        publishedInput,
        source.reviewedEvidence,
    );
    if (!prepared.ready) throw new Error(prepared.errors.join('; '));
    return prepared.offers.map((offer) => {
        const proof = prepared.evidence.find(
            (entry) => entry.productId === offer.snapshot.productId,
        );
        if (!proof) throw new Error('Missing exact reviewed recipe proof');
        const {
            productId: _product,
            productVersionId: _version,
            ...evidence
        } = proof;
        const snapshot = gardenPackProductSnapshotSchema.parse({
            ...offer.snapshot,
            publication: 'published',
            availableFrom: windowInput.availableFrom,
            availableUntil: windowInput.availableUntil,
        });
        snapshot.productVersionId = getAutumnStarterPackVersion(
            snapshot,
            evidence,
        );
        return {
            snapshot,
            sale: { enabled: false, availableFrom: null, availableUntil: null },
        };
    });
}
