import { Head, Html, Preview, Section, Tailwind, Text } from 'react-email';
import { ContentCard } from '../../components/ContentCard';
import { Divider } from '../../components/Divider';
import { GrediceLogotype } from '../../components/GrediceLogotype';
import { Header } from '../../components/Header';
import { Paragraph } from '../../components/Paragraph';
import { PrimaryButton } from '../../components/PrimaryButton';
import { GrediceDisclaimer } from '../../components/shared/GrediceDisclaimer';

export interface OrderConfirmationEmailItem {
    name?: string | null;
    quantity?: number | null;
    amountSubtotal?: number | null;
    currency?: string | null;
}

export interface OrderConfirmationEmailTemplateProps {
    email: string;
    items: OrderConfirmationEmailItem[];
    orderReference?: string | null;
    totalAmountCents?: number | null;
    currency?: string | null;
    manageUrl?: string;
    appName?: string;
    appDomain?: string;
}

function formatQuantity(quantity?: number | null) {
    return typeof quantity === 'number' && quantity > 0 ? quantity : 1;
}

function formatCurrency(amountCents: number, currency?: string | null) {
    const currencyCode = currency?.toUpperCase() || 'EUR';
    try {
        return new Intl.NumberFormat('hr-HR', {
            style: 'currency',
            currency: currencyCode,
        }).format(amountCents / 100);
    } catch {
        return `${(amountCents / 100).toFixed(2)} ${currencyCode}`;
    }
}

function formatAmount(item: OrderConfirmationEmailItem) {
    if (typeof item.amountSubtotal !== 'number') {
        return null;
    }

    if (item.currency === 'sunflower') {
        return `${item.amountSubtotal} suncokreta`;
    }

    if (item.currency === 'inventory') {
        return 'Ruksak';
    }

    if (item.amountSubtotal === 0) {
        return 'Uključeno';
    }

    return formatCurrency(item.amountSubtotal, item.currency);
}

export default function OrderConfirmationEmailTemplate({
    email,
    items,
    orderReference,
    totalAmountCents,
    currency = 'eur',
    manageUrl = 'https://vrt.gredice.com',
    appName = 'Gredice',
    appDomain = 'gredice.com',
}: OrderConfirmationEmailTemplateProps) {
    const previewText = `${appName} - potvrda narudžbe`;
    const visibleItems: OrderConfirmationEmailItem[] =
        items.length > 0 ? items : [{ name: 'Narudžba' }];

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <ContentCard>
                    <Section className="text-center">
                        <GrediceLogotype />
                    </Section>
                    <Header>Potvrda narudžbe</Header>
                    <Paragraph>Bok!</Paragraph>
                    <Paragraph>
                        Tvoja narudžba je potvrđena. Pripremili smo stavke za
                        tvoj vrt i pratit ćemo ih kroz dogovorene radnje,
                        dostavu ili preuzimanje.
                    </Paragraph>
                    {orderReference ? (
                        <Paragraph>
                            <strong>Referenca:</strong> {orderReference}
                        </Paragraph>
                    ) : null}
                    <Section className="my-[24px]">
                        {visibleItems.map((item) => {
                            const amount = formatAmount(item);
                            const quantity = formatQuantity(item.quantity);
                            const itemKey = [
                                item.name?.trim() || 'item',
                                quantity,
                                item.amountSubtotal ?? 'unknown',
                                item.currency ?? 'none',
                            ].join('-');
                            return (
                                <Section
                                    className="border-[#eaeaea] border-t border-solid py-[12px]"
                                    key={itemKey}
                                >
                                    <Text className="m-0 text-[14px] font-semibold leading-[22px] text-black">
                                        {quantity}x{' '}
                                        {item.name?.trim() || 'Stavka'}
                                    </Text>
                                    {amount ? (
                                        <Text className="m-0 text-[13px] leading-[20px] text-[#475569]">
                                            {amount}
                                        </Text>
                                    ) : null}
                                </Section>
                            );
                        })}
                    </Section>
                    {typeof totalAmountCents === 'number' ? (
                        <Paragraph>
                            <strong>Ukupno:</strong>{' '}
                            {formatCurrency(totalAmountCents, currency)}
                        </Paragraph>
                    ) : null}
                    <Paragraph>
                        Ako narudžba uključuje radnje u vrtu, vidjet ćeš ih u
                        aplikaciji čim budu zakazane ili dovršene. Za stavke s
                        dostavom poslat ćemo posebnu obavijest o terminu.
                    </Paragraph>
                    <Section className="my-[32px] text-center">
                        <PrimaryButton href={manageUrl}>
                            Otvori svoj vrt
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
