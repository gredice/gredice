import { Head, Html, Preview, Section, Tailwind } from 'react-email';
import { ContentCard } from '../../components/ContentCard';
import { Divider } from '../../components/Divider';
import { GrediceLogotype } from '../../components/GrediceLogotype';
import { Header } from '../../components/Header';
import { Paragraph } from '../../components/Paragraph';
import { PrimaryButton } from '../../components/PrimaryButton';
import { GrediceContactChannels } from '../../components/shared/GrediceContactChannels';
import { GrediceDisclaimer } from '../../components/shared/GrediceDisclaimer';

export interface DeliveryReadyEmailTemplateProps {
    email: string;
    deliveryWindow: string;
    addressLine?: string;
    contactName?: string;
    manageUrl?: string;
    appName?: string;
    appDomain?: string;
}

export default function DeliveryReadyEmailTemplate({
    email,
    deliveryWindow,
    addressLine,
    contactName,
    manageUrl = 'https://vrt.gredice.com/?pregled=dostava',
    appName = 'Gredice',
    appDomain = 'gredice.com',
}: DeliveryReadyEmailTemplateProps) {
    const previewText = `${appName} - dostava je spremna`;
    const greeting = contactName ? `Bok ${contactName}!` : 'Bok!';

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <ContentCard>
                    <Section className="text-center">
                        <GrediceLogotype />
                    </Section>
                    <Header>Dostava je spremna! 🚚</Header>
                    <Paragraph>{greeting}</Paragraph>
                    <Paragraph>
                        Podsjećamo te da je tvoja dostava spremna za uručenje u
                        dogovorenom terminu.
                    </Paragraph>
                    <Paragraph>
                        <strong>📅 Termin:</strong> {deliveryWindow}
                    </Paragraph>
                    {addressLine ? (
                        <Paragraph>
                            <strong>📍 Adresa:</strong> {addressLine}
                        </Paragraph>
                    ) : null}
                    <GrediceContactChannels />
                    <Section className="my-[32px] text-center">
                        <PrimaryButton href={manageUrl}>
                            Prikaži detalje
                        </PrimaryButton>
                    </Section>
                    <Paragraph>Vidimo se uskoro! 🌱</Paragraph>
                    <Paragraph>{appName} tim</Paragraph>
                    <Divider className="my-[26px]" />
                    <GrediceDisclaimer email={email} appDomain={appDomain} />
                </ContentCard>
            </Tailwind>
        </Html>
    );
}
