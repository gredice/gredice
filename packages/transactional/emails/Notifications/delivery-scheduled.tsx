import {
    Head,
    Html,
    Preview,
    Section,
    Tailwind,
} from '@react-email/components';
import { ContentCard } from '../../components/ContentCard';
import { Divider } from '../../components/Divider';
import { GrediceDisclaimer } from '../../components/shared/GrediceDisclaimer';
import { GrediceLogotype } from '../../components/GrediceLogotype';
import { Header } from '../../components/Header';
import { Paragraph } from '../../components/Paragraph';
import { PrimaryButton } from '../../components/PrimaryButton';

export interface DeliveryScheduledEmailTemplateProps {
    email: string;
    deliveryWindow: string;
    addressLine?: string;
    contactName?: string;
    manageUrl?: string;
    appName?: string;
    appDomain?: string;
}

export default function DeliveryScheduledEmailTemplate({
    email,
    deliveryWindow,
    addressLine,
    contactName,
    manageUrl = 'https://vrt.gredice.com',
    appName = 'Gredice',
    appDomain = 'gredice.com',
}: DeliveryScheduledEmailTemplateProps) {
    const previewText = `${appName} - termin tvoje dostave`;
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
                    <Header>Hvala na narudžbi! 🌱</Header>
                    <Paragraph>{greeting}</Paragraph>
                    <Paragraph>
                        Zaprimili smo tvoj zahtjev za dostavu i spremit ćemo sve na
                        vrijeme za dogovoreni termin.
                    </Paragraph>
                    <Paragraph>
                        Čim pripremimo dostavu poslat ćemo ti podsjetnik s istim
                        informacijama.
                    </Paragraph>
                    <Paragraph>
                        <strong>📅 Termin:</strong> {deliveryWindow}
                    </Paragraph>
                    {addressLine ? (
                        <Paragraph>
                            <strong>📍 Adresa:</strong> {addressLine}
                        </Paragraph>
                    ) : null}
                    <Paragraph>
                        Budi dostupan/dostupna u navedenom terminu kako bismo mogli
                        predati dostavu bez čekanja.
                    </Paragraph>
                    <Section className="my-[32px] text-center">
                        <PrimaryButton href={manageUrl}>Otvori aplikaciju</PrimaryButton>
                    </Section>
                    <Paragraph>
                        Ako trebaš bilo kakvu pomoć, možeš nam se javiti direktno iz
                        aplikacije.
                    </Paragraph>
                    <Paragraph>{appName} tim</Paragraph>
                    <Divider className="my-[26px]" />
                    <GrediceDisclaimer email={email} appDomain={appDomain} />
                </ContentCard>
            </Tailwind>
        </Html>
    );
}
