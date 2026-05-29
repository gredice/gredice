import { orderBy } from '@gredice/js/arrays';
import { Avatar } from '@gredice/ui/Avatar';
import { Button } from '@gredice/ui/Button';
import { Markdown } from '@gredice/ui/Markdown';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { Navigate } from '@gredice/ui/icons';
import type { Metadata } from 'next';
import { NoDataPlaceholder } from '../../components/shared/placeholders/NoDataPlaceholder';
import { getFaqData } from '../../lib/plants/getFaqData';
import { FaqAccordionItem } from './FaqAccordionItem';

export const revalidate = 3600; // 1 hour
export const metadata: Metadata = {
    title: 'Česta pitanja',
    description: 'Odgovaramo na sva tvoja pitanja.',
};

export default async function FaqPage() {
    const faq = await getFaqData();
    const categories = orderBy(
        [
            ...new Set(
                faq?.map(
                    (item) => item.attributes?.category?.information?.label,
                ),
            ),
        ],
        (a, b) => (a && b ? a.localeCompare(b) : 0),
    );

    return (
        <div className="flex flex-col lg:flex-row lg:gap-16 py-8">
            {/* Sticky left sidebar */}
            <div className="lg:w-2/5 lg:sticky lg:top-24 lg:self-start mb-10 lg:mb-0">
                <Stack spacing={8}>
                    <Stack spacing={3}>
                        <h1 className="text-4xl font-bold leading-tight tracking-tight">
                            Česta pitanja
                        </h1>
                        <Typography level="body1" className="text-muted-foreground">
                            Cijene, proces, postavljanje tima, komunikacija,
                            vlasništvo, rokovi i kako je to stvarno raditi s
                            nama.
                        </Typography>
                    </Stack>
                    <div className="flex flex-col gap-4">
                        <div className="flex -space-x-2">
                            <Avatar size="lg" alt="Član tima">
                                <span className="text-sm font-medium">AT</span>
                            </Avatar>
                            <Avatar size="lg" alt="Član tima" className="ring-2 ring-background">
                                <span className="text-sm font-medium">GR</span>
                            </Avatar>
                        </div>
                        <Stack spacing={2}>
                            <Typography level="body1" className="font-semibold">
                                Imaš još pitanja?
                            </Typography>
                            <Typography level="body1" className="text-muted-foreground">
                                Pošalji nam više konteksta i reći ćemo ti
                                možemo li ti pomoći.
                            </Typography>
                        </Stack>
                        <Stack spacing={2}>
                            <Button disabled variant="outlined" className="w-fit">
                                Razgovarajmo!
                            </Button>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <span>Ili nam piši</span>
                                <Navigate className="size-3.5" />
                                <a
                                    href="mailto:info@gredice.com"
                                    className="hover:text-foreground transition-colors"
                                >
                                    info@gredice.com
                                </a>
                            </div>
                        </Stack>
                    </div>
                </Stack>
            </div>

            {/* FAQ content */}
            <div className="lg:w-3/5">
                {!faq?.length && (
                    <div className="border rounded py-4">
                        <NoDataPlaceholder>
                            Nema dostupnih pitanja
                        </NoDataPlaceholder>
                    </div>
                )}
                <Stack spacing={10}>
                    {categories.map((category) => (
                        <div key={category}>
                            {category && (
                                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                                    {category}
                                </p>
                            )}
                            <div className="border-t">
                                {faq
                                    ?.filter(
                                        (item) =>
                                            item.attributes?.category
                                                ?.information?.label ===
                                            category,
                                    )
                                    .map((item) => (
                                        <FaqAccordionItem
                                            key={item.information.name}
                                            header={item.information.header}
                                        >
                                            <Markdown>
                                                {item.information.content}
                                            </Markdown>
                                        </FaqAccordionItem>
                                    ))}
                            </div>
                        </div>
                    ))}
                </Stack>
            </div>
        </div>
    );
}
