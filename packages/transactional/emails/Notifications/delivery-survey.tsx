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
    deliveryDate?: string;
    appName?: string;
    appDomain?: string;
}

export default function DeliverySurveyEmailTemplate({
    email = 'login@example.com',
    surveyUrl = 'https://form.typeform.com/to/X727vyBk',
    deliveryDate,
    appName = 'Gredice',
    appDomain = 'gredice.com',
}: DeliverySurveyEmailTemplateProps) {
    const previewText = `${appName} - Podijeli dojam o dostavi`;

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
                        Nadamo se da su te posljednji paketi iz našeg vrta razveselili.{' '}
                        Voljeli bismo čuti tvoje dojmove o dostavi kako bismo idući put bili još bolji.
                    </Paragraph>
                    {deliveryDate ? (
                        <Paragraph>
                            Dostava je stigla {deliveryDate}.{' '}
                            Odvoji koju minutu i reci nam kako je prošla.
                        </Paragraph>
                    ) : null}
                    <Paragraph>
                        Kratka anketa traje manje od minute, a svaki odgovor pomaže našem timu i vrtlarima.
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
