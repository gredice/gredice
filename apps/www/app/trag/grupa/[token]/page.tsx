import { getPublicHarvestTraceGroupByToken } from '@gredice/storage';
import { CtaBand } from '../../../../components/shared/CtaBand';
import { createPublicMetadata } from '../../../../lib/seo/publicMetadata';
import { KnownPages } from '../../../../src/KnownPages';
import { InvalidTraceState } from '../../InvalidTraceState';
import { HarvestTraceGroup } from './HarvestTraceGroup';

export const dynamic = 'force-dynamic';
export const metadata = createPublicMetadata({
    title: 'Trag grupe berbe',
    description: 'Odaberi polje za detalje berbe Gredice.',
    robots: { index: false, follow: false },
});

export default async function HarvestTraceGroupPage(
    props: PageProps<'/trag/grupa/[token]'>,
) {
    const { token } = await props.params;
    const group = await getPublicHarvestTraceGroupByToken(token);
    if (!group) {
        return (
            <InvalidTraceState description="Poveznica nije važeća ili su tragovi berbe opozvani. Provjeri etiketu ili nam se javi ako trebaš pomoć." />
        );
    }
    return (
        <>
            <HarvestTraceGroup group={group} />
            <CtaBand
                id="harvest-trace-group-cta-title"
                title="Uzgoji i ti svoje povrće."
                description="Složi gredicu u aplikaciji, a tim na OPG-u je sadi, njeguje i bere za tebe."
                secondaryAction={{
                    href: KnownPages.RaisedBeds,
                    label: 'Kako funkcionira gredica',
                }}
                className="mb-12"
            />
        </>
    );
}
