import { createHash } from 'node:crypto';
import { bustCached, cacheKeys } from '../src/cache/directoriesCached';
import {
    normalizeCmsPageContent,
    parseCmsPageContent,
} from '../src/cmsPageContent';
import { closeStorage, getCmsPages, updateCmsPage } from '../src/index';

const selections = new Map([
    [
        'dostava-povrca-zagreb',
        [
            'vegetable-box',
            'delivery-price',
            'delivery-pickup',
            'delivery-booking',
            'delivery-coverage',
        ],
    ],
    [
        'biljni-susjedi',
        [
            'companion-planting-choice',
            'companion-planting-distance',
            'companion-planting-missing',
            'companion-planting-use',
        ],
    ],
    [
        'kvaliteta-i-sigurnost-uroda',
        [
            'kvaliteta-haccp-certifikacija',
            'kvaliteta-pracenje-sigurnosti',
            'kvaliteta-pranje-uroda',
            'kvaliteta-sumnja-na-problem',
        ],
    ],
]);
const args = process.argv.slice(2);
for (const arg of args)
    if (arg !== '--apply' && !arg.startsWith('--expect='))
        throw new Error(`Unknown argument: ${arg}`);
const apply = args.includes('--apply');
const expected = args.find((arg) => arg.startsWith('--expect='))?.slice(9);
async function main() {
    if (
        apply &&
        (!process.env.PLANTS_SILO_KV_REST_API_URL ||
            !process.env.PLANTS_SILO_KV_REST_API_TOKEN)
    )
        throw new Error('Apply requires WWW directory cache credentials.');
    const pages = (await getCmsPages()).filter((page) =>
        selections.has(page.slug),
    );
    const planned = pages.map((page) => {
        if (!page.content)
            throw new Error(`Missing content for page ${page.id}`);
        const document = parseCmsPageContent(page.content);
        const slugs = selections.get(page.slug);
        if (
            !slugs ||
            document.sections.filter((section) => section.component === 'Faq1')
                .length !== 1
        )
            throw new Error(`Unexpected FAQ layout for page ${page.id}`);
        const sections = document.sections.map((section) =>
            section.component === 'Faq1'
                ? {
                      ...section,
                      // Keep old features for deployments that do not resolve references yet.
                      // New rendering ignores those copies whenever faqSlugs is populated.
                      faqSlugs: slugs.join('\n'),
                      ctas: [
                          {
                              label: 'Sva česta pitanja',
                              href: '/cesta-pitanja',
                          },
                          {
                              label: 'Zatraži pomoć',
                              href: '/kontakt',
                              secondary: true,
                          },
                      ],
                  }
                : section,
        );
        return {
            page,
            content: normalizeCmsPageContent(
                JSON.stringify(
                    Array.isArray(JSON.parse(page.content))
                        ? sections
                        : { ...document, sections },
                ),
            ),
        };
    });
    const changes = planned.filter(
        ({ page, content }) => page.content !== content,
    );
    const hash = createHash('sha256')
        .update(
            JSON.stringify(
                planned.map(({ page, content }) => ({
                    id: page.id,
                    before: page.content,
                    after: content,
                })),
            ),
        )
        .digest('hex');
    console.log(
        JSON.stringify(
            {
                mode: apply ? 'apply' : 'dry-run',
                hash,
                changes: changes.map(({ page }) => ({
                    id: page.id,
                    slug: page.slug,
                })),
            },
            null,
            2,
        ),
    );
    if (!apply) return;
    if (!expected || expected !== hash)
        throw new Error('Review a fresh dry run and pass its --expect=<hash>.');
    for (const { page, content } of changes)
        await updateCmsPage(
            { id: page.id, content },
            { id: 'codex-public-faq', name: 'Link shared public FAQ answers' },
        );
    for (const { page } of planned)
        await bustCached(cacheKeys.cmsPageBySlug(page.slug));
    for (const state of ['all', 'published', 'draft', 'in-review'] as const)
        await bustCached(cacheKeys.cmsPagesList(state));
    const persisted = await getCmsPages();
    for (const { page, content } of planned)
        if (persisted.find((item) => item.id === page.id)?.content !== content)
            throw new Error(`Readback failed for page ${page.id}`);
    console.log(
        JSON.stringify({
            verified: true,
            pages: planned.map(({ page }) => page.id),
        }),
    );
}
main()
    .catch(() => {
        console.error(
            'CMS FAQ linking failed; review the dry run and storage diagnostics.',
        );
        process.exitCode = 1;
    })
    .finally(closeStorage);
