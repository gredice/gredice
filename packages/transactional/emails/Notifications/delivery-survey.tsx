import {
    Head,
    Html,
    Preview,
    Section,
    Tailwind,
} from '@react-email/components';
import { formatDeliveryCount } from '@gredice/js/i18n';
import { ContentCard } from '../../components/ContentCard';
import { Divider } from '../../components/Divider';
import { GrediceDisclaimer } from '../../components/shared/GrediceDisclaimer';
import { GrediceLogotype } from '../../components/GrediceLogotype';
import { Header } from '../../components/Header';
import { Paragraph } from '../../components/Paragraph';
import { PrimaryButton } from '../../components/PrimaryButton';

export interface DeliverySurveyEmailTemplateProps {
    email: string;
    surveyUrl: string;
    deliveryPeriod?: string;
    deliveryCount?: number;
    appName?: string;
    appDomain?: string;
}

export default function DeliverySurveyEmailTemplate({
    email = 'login@example.com',
    surveyUrl = 'https://form.typeform.com/to/X727vyBk',
    deliveryPeriod,
    deliveryCount,
    appName = 'Gredice',
    appDomain = 'gredice.com',
}: DeliverySurveyEmailTemplateProps) {
    const previewText = `${appName} - Podijeli dojam o dostavama`;

    const periodSummary = deliveryPeriod
        ? `🚚 Tijekom ${deliveryPeriod} ${
              typeof deliveryCount === 'number'
                  ? formatDeliveryCount(deliveryCount, true)
                  : 'bilo je nekoliko dostava'
          }.`
        : null;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <ContentCard>
                    <Section className="text-center">
                        <GrediceLogotype />
                    </Section>
                    <Header>Kakve su bile dostave?</Header>
                    <Paragraph>Pozdrav!</Paragraph>
                    <Paragraph>
                        Nadamo se da te povrće iz tvog vrta razveselilo.{' '}
                        Voljeli bismo čuti tvoje dojmove o dostavama kako bismo idući put bili još bolji.
                    </Paragraph>
                    {periodSummary ? (
                        <Paragraph>{periodSummary}</Paragraph>
                    ) : null}
                    <Paragraph>
                        ⏱️ Anketa traje manje od minute, a svaki odgovor pomaže našem timu unaprijediti uslugu dostave.
                    </Paragraph>
                    <Section className="my-[32px] text-center">
                        <PrimaryButton href={surveyUrl}>Ispuni anketu</PrimaryButton>
                    </Section>
                    <Paragraph>Hvala ti što rasteš s nama! 🌱</Paragraph>
                    <Paragraph>
                        {appName} tim
                    </Paragraph>
                    <Divider className="my-[26px]" />
                    <GrediceDisclaimer email={email} appDomain={appDomain} />
                </ContentCard>
            </Tailwind>
        </Html>
    );
}
