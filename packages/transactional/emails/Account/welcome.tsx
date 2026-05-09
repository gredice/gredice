import { Head, Html, Preview, Section, Tailwind } from 'react-email';
import { ContentCard } from '../../components/ContentCard';
import { Divider } from '../../components/Divider';
import { GrediceLogotype } from '../../components/GrediceLogotype';
import { Paragraph } from '../../components/Paragraph';
import { PrimaryButton } from '../../components/PrimaryButton';
import { GrediceContactChannels } from '../../components/shared/GrediceContactChannels';
import { GrediceDisclaimer } from '../../components/shared/GrediceDisclaimer';

export interface WelcomeEmailTemplateProps {
    email: string;
    ctaUrl: string;
    appName?: string;
    appDomain?: string;
}

export default function WelcomeEmailTemplate({
    email = 'login@example.com',
    ctaUrl = 'https://vrt.gredice.com',

    appName = 'Gredice',
    appDomain = 'gredice.com',
}: WelcomeEmailTemplateProps) {
    const previewText = `Pozdrav od ${appName}`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <ContentCard>
                    <Section className="text-center">
                        <GrediceLogotype />
                    </Section>
                    <Paragraph>Pozdrav,</Paragraph>
                    <Paragraph>
                        Tvoje Gredice te čekaju! 🥕🍅 Mi smo tu da ti omogućimo
                        da uživaš u svježem povrću i okusima domaćih vrtova -
                        čak i ako nemaš vlastiti vrt ili vremena za sadnju.
                    </Paragraph>
                    <Paragraph>
                        Uz Gredice možeš:
                        <br />🌿 Saditi i pratiti kako tvoje povrće raste.
                        <br />📦 Dobiti ubrane plodove direktno na svoju adresu.
                        <br />🌎 Podržavati lokalne uzgajivače i održivu
                        poljoprivredu.
                        <br />
                    </Paragraph>
                    <Paragraph>
                        Sad kad si dio naše zajednice, vrijeme je da krenemo!
                        Istraži ponudu i odaberi što želiš posaditi. Prvi korak
                        prema zelenijem i ukusnijem svijetu je samo nekoliko
                        klikova udaljen.
                    </Paragraph>
                    <Section className="my-[32px] text-center">
                        <PrimaryButton href={ctaUrl}>
                            Posjeti svoj vrt
                        </PrimaryButton>
                    </Section>
                    <GrediceContactChannels />
                    <Paragraph>Sretno vrtlarenje! 🌻</Paragraph>
                    <Paragraph>
                        Zeleni pozdrav,
                        <br />
                        Gredice tim
                    </Paragraph>
                    <Divider className="my-[26px]" />
                    <GrediceDisclaimer email={email} appDomain={appDomain} />
                </ContentCard>
            </Tailwind>
        </Html>
    );
}
