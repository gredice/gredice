/* eslint-disable tailwindcss/enforces-shorthand */
/* eslint-disable tailwindcss/classnames-order */
import {
    Head,
    Html,
    Img,
    Preview,
    Section, Tailwind,
} from '@react-email/components';
import { PrimaryButton } from '../components/PrimaryButton';
import { Paragraph } from '../components/Paragraph';
import { Link } from '../components/Link';
import { Divider } from '../components/Divider';
import { Disclaimer } from '../components/Disclaimer';
import { ContentCard } from '../components/ContentCard';
import { GrediceLogotype } from '../components/GrediceLogotype';

interface WelcomeEmailTemplateProps {
    email: string;
    ctaUrl: string;
    appName: string;
    appDomain: string;
}

export default function WelcomeEmailTemplate({
    email = 'login@example.com',
    ctaUrl = 'https://vrt.gredice.com',

    appName = 'Gredice',
    appDomain = 'gredice.com'
}: WelcomeEmailTemplateProps) {
    const previewText = `Login request for ${appName}`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <ContentCard>
                    <Section className='text-center'>
                        <GrediceLogotype />
                    </Section>
                    <Paragraph>Pozdrav,</Paragraph>
                    <Paragraph>Tvoje Gredice te čekaju! 🥕🍅 Mi smo tu da ti omogućimo da uživaš u svježem povrću i okusima domaćih vrtova - čak i ako nemaš vlastiti vrt ili vremena za sadnju.</Paragraph>
                    <Paragraph>
                        Uz Gredice možeš:<br />
                        🌿 Saditi i pratiti kako tvoje povrće raste.<br />
                        📦 Dobiti ubrane plodove direktno na svoju adresu.<br />
                        🌎 Podržavati lokalne uzgajivače i održivu poljoprivredu.<br />
                    </Paragraph>
                    <Paragraph>Sad kad si dio naše zajednice, vrijeme je da krenemo! Istraži ponudu i odaberi što želiš posaditi. Prvi korak prema zelenijem i ukusnijem svijetu je samo nekoliko klikova udaljen.</Paragraph>
                    <Section className="my-[32px] text-center">
                        <PrimaryButton href={ctaUrl}>Posjeti svoj vrt</PrimaryButton>
                    </Section>
                    <Paragraph>Ako imaš pitanja ili trebaš pomoć, slobodno nam se javi - ovdje smo za tebe!</Paragraph>
                    <Paragraph>Sretno vrtlarenje! 🌻</Paragraph>
                    <Paragraph>Zeleni pozdrav,<br />Gredice tim</Paragraph>
                    <Paragraph>P.S. Pratite nas i na društvenim mrežama za savjete, trikove i priče iz vrtova. 🌍</Paragraph>
                    <Divider className="my-[26px]" />
                    <Disclaimer>
                        Ovaj email je namjenjen za{' '}
                        <span className="text-black">{email}</span>. U slučaju da misliš da je tvoj račun ugrožen,
                        molimo kontaktiraj nas na{' '}
                        <Link href={`mailto:security@${appDomain}`}>security@{appDomain}</Link>
                    </Disclaimer>
                </ContentCard>
            </Tailwind>
        </Html>
    );
}