/* eslint-disable tailwindcss/enforces-shorthand */
/* eslint-disable tailwindcss/classnames-order */
import {
    Head,
    Html,
    Preview,
    Section, Tailwind,
} from '@react-email/components';
import { PrimaryButton } from '../components/PrimaryButton';
import { Paragraph } from '../components/Paragraph';
import { Link } from '../components/Link';
import { Header } from '../components/Header';
import { Divider } from '../components/Divider';
import { Disclaimer } from '../components/Disclaimer';
import { ContentCard } from '../components/ContentCard';
import { GrediceLogotype } from '../components/GrediceLogotype';

export interface EmailVerifyEmailTemplateProps {
    email: string;
    confirmLink: string;
    appName?: string;
    appDomain?: string;
}

export default function EmailVerifyEmailTemplate({
    email = 'login@example.com',
    confirmLink = 'https://vrt.gredice.com/prijava/potvrda-emaila',

    appName = 'Gredice',
    appDomain = 'gredice.com'
}: EmailVerifyEmailTemplateProps) {
    const previewText = `Potvrda email adrese za ${appName}`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <ContentCard>
                    <Section className='text-center'>
                        <GrediceLogotype />
                    </Section>
                    <Header>Potvrda email adrese</Header>
                    <Paragraph>Primili smo zahtjev za potvrdu email adrese: <strong>{email}</strong></Paragraph>
                    <Paragraph>Ako navedeni email odgovara traženom, klikni na gumb ispod za potvrdu.
                    </Paragraph>
                    <Section className="my-[32px] text-center">
                        <PrimaryButton href={confirmLink}>Potvrdi email</PrimaryButton>
                    </Section>
                    <Paragraph>
                        Ukoliko ne očekuješ ovu potvrdu, možeš zanemariti ovaj email.
                    </Paragraph>
                    <Divider className="my-[26px]" />
                    <Disclaimer>
                        Ovaj email je namjenjen za{' '}
                        <span className="text-black">{email}</span>. Ako ne očekuješ
                        ovu potvrdu, možeš zanemariti ovaj email. U slučaju da misliš da je tvoj račun ugrožen,
                        molimo kontaktiraj nas na{' '}
                        <Link href={`mailto:security@${appDomain}`}>security@{appDomain}</Link>
                    </Disclaimer>
                </ContentCard>
            </Tailwind>
        </Html>
    );
}