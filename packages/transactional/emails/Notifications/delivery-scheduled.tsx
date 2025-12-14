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
    manageUrl = 'https://vrt.gredice.com/?pregled=dostava',
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
                        Zaprimili smo tvoj zahtjev za dostavu i pripremiti ćemo
                        sve na vrijeme za dogovoreni termin.
                    </Paragraph>
                    <Paragraph>
                        Čim pripremimo dostavu poslat ćemo ti podsjetnik s istim
                        informacijama.
                    </Paragraph>
                    <Paragraph>
                        <strong>📅 Termin:</strong> {deliveryWindow}
                    </Paragraph>
                    {addressLine ? (
                        <>
                            <Paragraph>
                                <strong>📍 Adresa:</strong> {addressLine}
                            </Paragraph>
                            <Paragraph>
                                Budi na adresi u navedenom terminu kako bismo ti
                                mogli predati dostavu bez čekanja.
                            </Paragraph>
                        </>
                    ) : (
                        <Paragraph>
                            Dostava će te čekati na našoj lokaciji u navedenom
                            terminu.
                        </Paragraph>
                    )}
                    <Section className="my-[32px] text-center">
                        <PrimaryButton href={manageUrl}>
                            Pogledaj svoje dostave
                        </PrimaryButton>
                    </Section>
                    <Paragraph>{appName} tim</Paragraph>
                    <Divider className="my-[26px]" />
                    <GrediceDisclaimer email={email} appDomain={appDomain} />
                </ContentCard>
            </Tailwind>
        </Html>
    );
}
