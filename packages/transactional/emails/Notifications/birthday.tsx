import {
    Head,
    Html,
    Preview,
    Section,
    Tailwind,
} from '@react-email/components';
import { ContentCard } from '../../components/ContentCard';
import { GrediceLogotype } from '../../components/GrediceLogotype';
import { Header } from '../../components/Header';
import { Paragraph } from '../../components/Paragraph';
import { GrediceDisclaimer } from '../../components/shared/GrediceDisclaimer';

export interface BirthdayEmailTemplateProps {
    name?: string;
    sunflowerAmount?: number;
    late?: boolean;
    appDomain?: string;
    email: string;
}

export default function BirthdayEmailTemplate({
    name = 'prijatelju',
    sunflowerAmount = 6000,
    late = false,
    appDomain = 'gredice.com',
    email,
}: BirthdayEmailTemplateProps) {
    const previewText = late
        ? `🎉 Sretan rođendan! ${sunflowerAmount} suncokreta stiže s malim zakašnjenjem.`
        : `🎉 Sretan rođendan! ${sunflowerAmount} suncokreta čeka na tebe.`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <ContentCard>
                    <Section className="text-center">
                        <GrediceLogotype />
                    </Section>
                    <Header>Sretan rođendan!</Header>
                    <Paragraph>Dragi {name},</Paragraph>
                    {late ? (
                        <Paragraph>
                            Sunce nas je mrvicu preteklo, ali poklon je sada tu! Na tvoj račun
                            smo upravo dodali {sunflowerAmount} 🌻 kako bi proslava bila još
                            veselija.
                        </Paragraph>
                    ) : (
                        <Paragraph>
                            Za tvoj poseban dan darujemo ti {sunflowerAmount} 🌻 kako bi vrt
                            zablistao još sjajnije.
                        </Paragraph>
                    )}
                    <Paragraph>
                        Uživaj u slavlju i hvala ti što s nama gradiš najveseliji vrt.
                    </Paragraph>
                    <Paragraph>Želimo ti puno radosti i uspješnu sezonu! 🌼</Paragraph>
                    <Paragraph className="mt-8 text-sm text-muted-foreground">
                        Ako želiš vidjeti kako napreduju tvoje gredice, posjeti svoj vrt na
                        <br />
                        <a href={`https://vrt.${appDomain}`}>vrt.{appDomain}</a>
                    </Paragraph>
                    <GrediceDisclaimer email={email} appDomain={appDomain} />
                </ContentCard>
            </Tailwind>
        </Html>
    );
}
