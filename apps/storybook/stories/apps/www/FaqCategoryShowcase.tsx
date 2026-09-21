import { FaqCategorySection } from '@apps/www/components/faq/FaqCategorySection';
import { FaqCategoryVisual } from '@apps/www/components/faq/FaqCategoryVisual';
import {
    faqCategoryArtwork,
    getFaqCategoryArtwork,
} from '@apps/www/components/faq/faqCategoryArtwork';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Typography } from '@gredice/ui/Typography';
import type { ComponentProps } from 'react';

const questions = [
    'Zašto se neke biljke uklone nakon berbe, a neke ne?',
    'Mogu li odabrati koje biljke ili povrće će rasti u mom vrtu?',
    'Koji su postupci dokumentirani?',
    'Koliko često se vrt mora održavati?',
    'Kako se usluga koristi?',
];

export function FaqCategoryShowcase({
    dark = false,
    compact = false,
    fallback = false,
}: {
    dark?: boolean;
    compact?: boolean;
    fallback?: boolean;
}) {
    return (
        <div className={dark ? 'dark' : undefined}>
            <main className="min-h-screen bg-background text-foreground p-4 sm:p-8">
                <div className="mx-auto max-w-5xl space-y-8">
                    <PageHeader
                        header="Česta pitanja"
                        subHeader="Odgovaramo na sva tvoja pitanja."
                    />
                    {faqCategoryArtwork.map((artwork, index) => {
                        const category = {
                            id: index + 1,
                            information: {
                                name: artwork.name,
                                label: artwork.label,
                            },
                        };
                        const entry = {
                            id: index + 1,
                            slug: `faq-preview-${index}`,
                            entityType: { id: 2, name: 'faq', label: 'FAQ' },
                            information: {
                                name: `faq-preview-${index}`,
                                header: questions[index] ?? artwork.label,
                                content:
                                    'Primjer odgovora u pregledu komponente. Ilustracija kategorije ostaje uz naslov, a sadržaj pitanja ostaje čitljiv.',
                            },
                            attributes: { category },
                            createdAt: '2026-09-21T00:00:00Z',
                            updatedAt: '2026-09-21T00:00:00Z',
                        } satisfies ComponentProps<
                            typeof FaqCategorySection
                        >['entries'][number];
                        return compact ? (
                            <div
                                key={artwork.name}
                                className="flex flex-wrap items-center gap-6"
                            >
                                {[24, 40, 64, 160].map((size) => (
                                    <FaqCategoryVisual
                                        key={size}
                                        category={category}
                                        size={size}
                                    />
                                ))}
                                <Typography>{artwork.label}</Typography>
                            </div>
                        ) : (
                            <FaqCategorySection
                                key={artwork.name}
                                category={category}
                                entries={[entry]}
                            />
                        );
                    })}
                    {fallback && (
                        <div className="space-y-4">
                            <Typography component="h2" level="h4">
                                Dodatne kategorije
                            </Typography>
                            <div className="flex items-center gap-4">
                                <FaqCategoryVisual
                                    category={{
                                        information: { name: 'new-category' },
                                    }}
                                />
                                <Typography>
                                    Nova kategorija bez slike
                                </Typography>
                            </div>
                            <div className="flex items-center gap-4">
                                <FaqCategoryVisual
                                    category={{
                                        image: {
                                            cover: {
                                                url: '/missing-faq-image.webp',
                                            },
                                        },
                                    }}
                                />
                                <Typography>Nedostupna slika</Typography>
                            </div>
                            <div className="flex items-center gap-4">
                                <FaqCategoryVisual
                                    category={{
                                        information: { name: 'new-category' },
                                        image: {
                                            cover: {
                                                url: getFaqCategoryArtwork(
                                                    'usage',
                                                ),
                                            },
                                        },
                                    }}
                                />
                                <Typography>
                                    Nova kategorija s odabranom slikom
                                </Typography>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
