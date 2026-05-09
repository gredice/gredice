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
    readyItems?: string[];
    appName?: string;
    appDomain?: string;
}

export default function DeliveryReadyEmailTemplate({
    email,
    deliveryWindow,
    addressLine,
    contactName,
    manageUrl = 'https://vrt.gredice.com/?pregled=dostava',
    readyItems = [],
    appName = 'Gredice',
    appDomain = 'gredice.com',
}: DeliveryReadyEmailTemplateProps) {
    const distinctReadyItems = Array.from(
        new Set(readyItems.map((item) => item.trim()).filter(Boolean)),
    );
    const readyItemsCount = distinctReadyItems.length;
    const readyItemsPreviewText =
        readyItemsCount === 1
            ? '1 stavka je spremna'
            : readyItemsCount < 5
              ? `${readyItemsCount} stavke su spremne`
              : `${readyItemsCount} stavki je spremno`;
    const previewText =
        readyItemsCount > 0
            ? `${appName} - ${readyItemsPreviewText}`
            : `${appName} - dostava je spremna`;
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
                    {readyItemsCount > 0 ? (
                        <Section className="my-4 rounded-2xl bg-[#f7f7f7] p-4">
                            <Paragraph className="m-0 text-[16px] font-semibold">
                                Spremno za dostavu:
                            </Paragraph>
                            {distinctReadyItems.map((item) => (
                                <Paragraph
                                    key={item}
                                    className="m-0 py-1 text-[15px]"
                                >
                                    • {item}
                                </Paragraph>
                            ))}
                        </Section>
                    ) : null}
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
