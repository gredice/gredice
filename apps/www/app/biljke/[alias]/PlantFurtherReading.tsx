import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { KnownPages } from '../../../src/KnownPages';

export function PlantFurtherReading() {
    return (
        <Typography level="body1" component="p">
            Želiš saznati više o tome kako naručiti sjetvu? Posjeti našu
            stranicu o{' '}
            <Link className="underline" href={KnownPages.Sowing}>
                sjetvi biljaka
            </Link>{' '}
            za detalje o sjetvi, rasporedu i pogodnostima. Biljni susjedi su
            smjernice za planiranje blizine biljaka.{' '}
            <Link className="underline" href={KnownPages.CompanionPlanting}>
                Saznaj kako ih čitati
            </Link>
            .
        </Typography>
    );
}
