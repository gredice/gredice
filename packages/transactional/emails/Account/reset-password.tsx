/* eslint-disable tailwindcss/enforces-shorthand */
/* eslint-disable tailwindcss/classnames-order */
import {
    Head,
    Html,
    Preview,
    Section, Tailwind,
} from '@react-email/components';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Paragraph } from '../../components/Paragraph';
import { Header } from '../../components/Header';
import { Divider } from '../../components/Divider';
import { ContentCard } from '../../components/ContentCard';
import { GrediceLogotype } from '../../components/GrediceLogotype';
import { GrediceDisclaimer } from '../../components/shared/GrediceDisclaimer';

export interface ResetPasswordEmailTemplateProps {
    email: string;
    confirmLink: string;
    appName?: string;
    appDomain?: string;
}

export default function ResetPasswordEmailTemplate({
    email = 'login@example.com',
    confirmLink = 'https://vrt.gredice.com/prijava/potvrda-emaila',

    appName = 'Gredice',
    appDomain = 'gredice.com'
}: ResetPasswordEmailTemplateProps) {
    const previewText = `Promjena zaporke za ${appName}`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <ContentCard>
                    <Section className='text-center'>
                        <GrediceLogotype />
                    </Section>
                    <Header>Promjena zaporke</Header>
                    <Paragraph>Primili smo zahtjev za promjenu zaporke za: <strong>{email}</strong></Paragraph>
                    <Paragraph>Ako navedeni email odgovara traženom, klikni na gumb ispod za nastavak promjene zaporke.
                    </Paragraph>
                    <Section className="my-[32px] text-center">
                        <PrimaryButton href={confirmLink}>Promjeni zaporku</PrimaryButton>
                    </Section>
                    <Divider className="my-[26px]" />
                    <GrediceDisclaimer email={email} appDomain={appDomain} />
                </ContentCard>
            </Tailwind>
        </Html>
    );
}