import { Head, Html, Preview, Section, Tailwind, Text } from 'react-email';
import { ContentCard } from '../../components/ContentCard';
import { Divider } from '../../components/Divider';
import { GrediceLogotype } from '../../components/GrediceLogotype';
import { Header } from '../../components/Header';
import { Paragraph } from '../../components/Paragraph';
import { PrimaryButton } from '../../components/PrimaryButton';
import { GrediceDisclaimer } from '../../components/shared/GrediceDisclaimer';

export interface BillingDocumentsEmailTemplateProps {
    email: string;
    invoiceNumber: string;
    invoiceUrl: string;
    receiptNumber?: string | null;
    receiptUrl?: string | null;
    billingUrl?: string;
    appName?: string;
    appDomain?: string;
}

export default function BillingDocumentsEmailTemplate({
    email,
    invoiceNumber,
    invoiceUrl,
    receiptNumber,
    receiptUrl,
    billingUrl = 'https://vrt.gredice.com/racun/naplata',
    appName = 'Gredice',
    appDomain = 'gredice.com',
}: BillingDocumentsEmailTemplateProps) {
    const previewText = `${appName} - dokumenti narudžbe`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <ContentCard>
                    <Section className="text-center">
                        <GrediceLogotype />
                    </Section>
                    <Header>Dokumenti narudžbe</Header>
                    <Paragraph>Bok!</Paragraph>
                    <Paragraph>
                        Tvoji dokumenti za plaćenu narudžbu su spremni u
                        korisničkom računu.
                    </Paragraph>
                    <Section className="my-[24px]">
                        <Text className="m-0 text-[14px] font-semibold leading-[22px] text-black">
                            Ponuda {invoiceNumber}
                        </Text>
                        <Text className="m-0 text-[13px] leading-[20px] text-[#475569]">
                            Dokument ponude možeš otvoriti direktno iz ovog
                            emaila ili kroz pregled naplate.
                        </Text>
                        <Section className="mt-[16px]">
                            <PrimaryButton href={invoiceUrl}>
                                Otvori ponudu
                            </PrimaryButton>
                        </Section>
                    </Section>
                    {receiptUrl ? (
                        <Section className="my-[24px]">
                            <Text className="m-0 text-[14px] font-semibold leading-[22px] text-black">
                                Fiskalni račun {receiptNumber ?? ''}
                            </Text>
                            <Text className="m-0 text-[13px] leading-[20px] text-[#475569]">
                                Fiskalni račun je povezan s istom narudžbom.
                            </Text>
                            <Section className="mt-[16px]">
                                <PrimaryButton href={receiptUrl}>
                                    Otvori račun
                                </PrimaryButton>
                            </Section>
                        </Section>
                    ) : null}
                    <Paragraph>
                        Sve dokumente možeš pronaći i u odjeljku Računi i
                        plaćanja.
                    </Paragraph>
                    <Section className="my-[32px] text-center">
                        <PrimaryButton href={billingUrl}>
                            Računi i plaćanja
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
