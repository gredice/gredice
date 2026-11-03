import { Calendar, Comment, Truck } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { Card } from '../../components/shared/Card';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { KnownPages } from '../../src/KnownPages';

const linkCardClassName =
    'flex h-full flex-col gap-2 p-5 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export function PlantsArchiveLinks() {
    return (
        <section
            aria-label="Korisne poveznice"
            className="mt-8 grid gap-4 md:grid-cols-3"
        >
            <Link href={KnownPages.SowingCalendar} className="rounded-lg">
                <Card className={linkCardClassName}>
                    <Calendar
                        aria-hidden
                        className="size-6 text-green-800 dark:text-green-400"
                    />
                    <Typography className="font-semibold">
                        Kalendar sjetve i sadnje
                    </Typography>
                    <Typography level="body2">
                        Objašnjenja radnji i regionalnih termina za
                        kontinentalnu Hrvatsku.
                    </Typography>
                    <Typography
                        level="body2"
                        className="mt-auto font-semibold text-green-800 dark:text-green-400"
                    >
                        Otvori kalendar →
                    </Typography>
                </Card>
            </Link>
            <Link href={KnownPages.DeliveryZagreb} className="rounded-lg">
                <Card className={linkCardClassName}>
                    <Truck
                        aria-hidden
                        className="size-6 text-green-800 dark:text-green-400"
                    />
                    <Typography className="font-semibold">
                        Dostava povrća u Zagrebu
                    </Typography>
                    <Typography level="body2">
                        Odaberi što želiš uzgajati, a zatim provjeri kako
                        funkcionira dostava povrća iz tvoje gredice.
                    </Typography>
                    <Typography
                        level="body2"
                        className="mt-auto font-semibold text-green-800 dark:text-green-400"
                    >
                        Kako funkcionira dostava →
                    </Typography>
                </Card>
            </Link>
            <Card className="flex h-full flex-col gap-2 p-5">
                <Comment
                    aria-hidden
                    className="size-6 text-green-800 dark:text-green-400"
                />
                <Typography className="font-semibold">
                    Nema biljke koja te zanima?
                </Typography>
                <Typography level="body2">
                    Sviđa ti se odabir ili ti nešto nedostaje? Javi nam.
                </Typography>
                <div className="mt-auto">
                    <FeedbackModal topic="www/plants" />
                </div>
            </Card>
        </section>
    );
}
