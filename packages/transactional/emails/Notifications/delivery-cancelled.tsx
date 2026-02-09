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
import { GrediceContactChannels } from '../../components/shared/GrediceContactChannels';
import { GrediceDisclaimer } from '../../components/shared/GrediceDisclaimer';

export interface DeliveryCancelledEmailTemplateProps {
    email: string;
    deliveryWindow: string;
    addressLine?: string;
    contactName?: string;
    manageUrl?: string;
    appName?: string;
    appDomain?: string;
}

export default function DeliveryCancelledEmailTemplate({
    email,
    deliveryWindow,
    addressLine,
    contactName,
    manageUrl = 'https://vrt.gredice.com/?pregled=dostava',
    appName = 'Gredice',
    appDomain = 'gredice.com',
}: DeliveryCancelledEmailTemplateProps) {
    const previewText = `${appName} - dostava je otkazana`;
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
                    <Header>Žao nam je - dostava je otkazana</Header>
                    <Paragraph>{greeting}</Paragraph>
                    <Paragraph>
                        Nažalost, dostava zakazana za navedeni termin je
                        otkazana.
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
                        Ako želiš, možeš provjeriti detalje narudžbe ili ponovno
                        dogovoriti termin u aplikaciji.
                    </Paragraph>
                    <Section className="my-[32px] text-center">
                        <PrimaryButton href={manageUrl}>
                            Upravljaj dostavama
                        </PrimaryButton>
                    </Section>
                    <GrediceContactChannels />
                    <Paragraph>{appName} tim</Paragraph>
                    <Divider className="my-[26px]" />
                    <GrediceDisclaimer email={email} appDomain={appDomain} />
                </ContentCard>
            </Tailwind>
        </Html>
    );
}
