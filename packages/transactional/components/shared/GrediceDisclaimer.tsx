import { Link } from 'react-email';
import { Disclaimer } from '../Disclaimer';

export function GrediceDisclaimer({
    email,
    appDomain,
}: {
    email: string;
    appDomain: string;
}) {
    return (
        <Disclaimer>
            Ovaj email je namjenjen za{' '}
            <span className="text-black">{email}</span>. Ukoliko misliš da je
            tvoj račun ugrožen, molimo kontaktiraj nas na{' '}
            <Link href={`mailto:sigurnost@${appDomain}`}>
                sigurnost@{appDomain}
            </Link>
            . Ova poruka poslana je automatski. Na ovu adresu nije moguće
            zaprimati odgovore. Ako imaš pitanja, molimo kontaktiraj nas drugim
            kanalima.
        </Disclaimer>
    );
}
