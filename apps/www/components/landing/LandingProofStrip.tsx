import { clientPublic } from '@gredice/client';
import { CountingNumber } from '@gredice/ui/CountingNumber';

async function getPlantStatistics() {
    try {
        const response = await clientPublic().api.data.statistics.plants.$get();
        if (response?.status !== 200) {
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to fetch plants statistics', error);
        return null;
    }
}

export async function LandingProofStrip() {
    const statistics = await getPlantStatistics();
    if (!statistics) {
        return null;
    }

    const counts = [
        {
            key: 'planted',
            value: statistics.totalPlantedPlants,
            label: 'posađenih biljaka u vrtovima korisnika',
        },
        {
            key: 'plants',
            value: statistics.totalPlants,
            label: 'dostupnih biljaka, začina i cvijeća',
        },
        {
            key: 'sorts',
            value: statistics.totalPlantSorts,
            label: 'dostupnih sorti za tvoje gredice',
        },
    ];

    return (
        <section aria-label="Gredice u brojkama">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-tertiary border-b-4 bg-border lg:grid-cols-4">
                {counts.map((count) => (
                    <div
                        key={count.key}
                        className="flex flex-col-reverse gap-1 bg-card p-5 sm:p-6"
                    >
                        <dt className="text-sm text-secondary-foreground">
                            {count.label}
                        </dt>
                        <dd className="m-0 font-[family-name:var(--font-montserrat)] text-3xl font-medium tabular-nums sm:text-4xl">
                            <CountingNumber number={count.value} inView>
                                {count.value.toString()}
                            </CountingNumber>
                        </dd>
                    </div>
                ))}
                <div className="flex flex-col-reverse gap-1 bg-card p-5 sm:p-6">
                    <dt className="text-sm text-secondary-foreground">
                        dostava na adrese u Gradu Zagrebu
                    </dt>
                    <dd className="m-0 font-[family-name:var(--font-montserrat)] text-3xl font-medium tabular-nums sm:text-4xl">
                        0 €
                    </dd>
                </div>
            </dl>
        </section>
    );
}
