import { Head, Html, Preview, Section, Tailwind } from 'react-email';
import { ContentCard } from '../../components/ContentCard';
import { Divider } from '../../components/Divider';
import { GrediceLogotype } from '../../components/GrediceLogotype';
import { Header } from '../../components/Header';
import { Paragraph } from '../../components/Paragraph';
import { PrimaryButton } from '../../components/PrimaryButton';
import { GrediceContactChannels } from '../../components/shared/GrediceContactChannels';
import { GrediceDisclaimer } from '../../components/shared/GrediceDisclaimer';

export interface AccountInvitationEmailTemplateProps {
    email: string;
    invitedByName: string;
    acceptUrl: string;
    appName?: string;
    appDomain?: string;
}

export default function AccountInvitationEmailTemplate({
    email = 'login@example.com',
    invitedByName = 'Korisnik',
    acceptUrl = 'https://vrt.gredice.com/pozivnica?token=abc',
    appName = 'Gredice',
    appDomain = 'gredice.com',
}: AccountInvitationEmailTemplateProps) {
    const previewText = `${invitedByName} te poziva da se pridružiš na ${appName}`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <ContentCard>
                    <Section className="text-center">
                        <GrediceLogotype />
                    </Section>
                    <Header>Pozivnica za pridruživanje</Header>
                    <Paragraph>Pozdrav,</Paragraph>
                    <Paragraph>
                        <strong>{invitedByName}</strong> te poziva da se
                        pridružiš zajedničkom računu na platformi {appName}.
                        Prihvaćanjem pozivnice moći ćeš dijeliti vrtove i
                        koristiti aplikaciju zajedno.
                    </Paragraph>
                    <Section className="my-[32px] text-center">
                        <PrimaryButton href={acceptUrl}>
                            Prihvati pozivnicu
                        </PrimaryButton>
                    </Section>
                    <Paragraph>
                        Ako ne očekuješ ovu pozivnicu, možeš zanemariti ovaj
                        email.
                    </Paragraph>
                    <GrediceContactChannels />
                    <Paragraph>
                        Zeleni pozdrav,
                        <br />
                        Gredice tim
                    </Paragraph>
                    <Divider className="my-[26px]" />
                    <GrediceDisclaimer email={email} appDomain={appDomain} />
                </ContentCard>
            </Tailwind>
        </Html>
    );
}
