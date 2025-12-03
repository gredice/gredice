import {
    Head,
    Html,
    Preview,
    Section,
    Tailwind,
} from '@react-email/components';
import { ContentCard } from '../../components/ContentCard';
import { Divider } from '../../components/Divider';
import { GrediceLogotype } from '../../components/GrediceLogotype';
import { Header } from '../../components/Header';
import { Paragraph } from '../../components/Paragraph';
import { PrimaryButton } from '../../components/PrimaryButton';
import { GrediceDisclaimer } from '../../components/shared/GrediceDisclaimer';

export type AccountDeleteConfirmationTemplateProps = {
    email: string;
    confirmLink: string;
    appName?: string;
    appDomain?: string;
};

export default function AccountDeleteConfirmationEmailTemplate({
    email,
    confirmLink,
    appName = 'Gredice',
    appDomain = 'gredice.com',
}: AccountDeleteConfirmationTemplateProps) {
    const previewText = `Potvrda brisanja računa za ${appName || 'Gredice'}`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <ContentCard>
                    <Section className="text-center">
                        <GrediceLogotype />
                    </Section>
                    <Header>Potvrda email adrese</Header>
                    <Paragraph>
                        Primili smo zahtjev za brisanje računa:{' '}
                        <strong>{email}</strong>
                    </Paragraph>
                    <Paragraph>
                        Ako navedeni email odgovara traženom, klikni na gumb
                        ispod za potvrdu.
                    </Paragraph>
                    <Section className="my-[32px] text-center">
                        <PrimaryButton href={confirmLink}>
                            Potvrdi brisanje računa
                        </PrimaryButton>
                    </Section>
                    <Paragraph>
                        Ukoliko ne očekuješ ovu potvrdu, možeš zanemariti ovaj
                        email.
                    </Paragraph>
                    <Divider className="my-[26px]" />
                    <GrediceDisclaimer email={email} appDomain={appDomain} />
                </ContentCard>
            </Tailwind>
        </Html>
    );
}
