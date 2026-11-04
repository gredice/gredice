import { getGardenBaseUrl } from '@gredice/js/urls';
import { Button } from '@gredice/ui/Button';
import { ArrowRight } from '@gredice/ui/icons';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import Image, { type StaticImageData } from 'next/image';
import SeedsAndTransplants from '../../assets/SeedsAndTransplants.webp';

/** Bright brand band that closes a public page with the main sign-up action. */
export function CtaBand({
    id,
    title,
    description,
    secondaryAction,
    image = SeedsAndTransplants,
    className,
}: {
    id: string;
    title: string;
    description: string;
    secondaryAction?: { href: string; label: string };
    image?: StaticImageData;
    className?: string;
}) {
    return (
        <section
            aria-labelledby={id}
            className={cx(
                'flex flex-col items-start gap-8 rounded-3xl bg-brand p-7 text-brand-foreground sm:flex-row sm:items-center sm:justify-between sm:p-12',
                className,
            )}
        >
            <div className="flex min-w-0 max-w-2xl flex-col gap-4">
                <Typography
                    id={id}
                    level="h2"
                    className="text-3xl text-brand-foreground sm:text-4xl"
                >
                    {title}
                </Typography>
                <Typography
                    level="body1"
                    className="text-pretty text-lg text-brand-foreground/85"
                >
                    {description}
                </Typography>
                <div className="mt-2 flex flex-wrap gap-3">
                    <NavigatingButton
                        href={getGardenBaseUrl()}
                        size="lg"
                        className="bg-brand-foreground text-brand hover:bg-brand-foreground/90"
                        endDecorator={
                            <ArrowRight aria-hidden className="size-4" />
                        }
                    >
                        Složi svoju gredicu
                    </NavigatingButton>
                    {secondaryAction ? (
                        <Button
                            href={secondaryAction.href}
                            size="lg"
                            variant="outlined"
                            className="border-brand-foreground/40 bg-transparent text-brand-foreground hover:bg-brand-foreground/10"
                        >
                            {secondaryAction.label}
                        </Button>
                    ) : null}
                </div>
            </div>
            <Image
                alt=""
                className="hidden size-48 shrink-0 object-contain sm:block lg:size-56"
                src={image}
                width={224}
                height={224}
            />
        </section>
    );
}
