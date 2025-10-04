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
    const previewText = `${appName} - Podijeli dojam o dostavi`;

    const formatDeliveryCount = (count: number) => {
        if (count === 1) {
            return '1 dostavu';
        }

        if (count >= 2 && count <= 4) {
            return `${count} dostave`;
        }

        return `${count} dostava`;
    };

    const periodSummary = deliveryPeriod
        ? `🚚 Tijekom ${deliveryPeriod} dostavili smo ti ${
              typeof deliveryCount === 'number'
                  ? formatDeliveryCount(deliveryCount)
                  : 'nekoliko dostava'
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
                    <Header>Kakva je bila dostava?</Header>
                    <Paragraph>Pozdrav!</Paragraph>
                    <Paragraph>
                        Nadamo se da te je povrće iz tvog vrta razveselilo.{' '}
                        Voljeli bismo čuti tvoje dojmove o dostavi kako bismo idući put bili još bolji.
                    </Paragraph>
                    {periodSummary ? (
                        <Paragraph>{periodSummary} </Paragraph>
                    ) : null}
                    <Paragraph>
                        ⏱️ Anketa traje manje od minute, a svaki odgovor pomaže našem timu i vrtlarima.
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
