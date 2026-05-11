import { Head, Html, Markdown, Preview, Section, Tailwind } from 'react-email';
import { ContentCard } from '../../components/ContentCard';
import { Disclaimer } from '../../components/Disclaimer';
import { Divider } from '../../components/Divider';
import { GrediceLogotype } from '../../components/GrediceLogotype';
import { Header } from '../../components/Header';
import { Link } from '../../components/Link';

export interface MarkdownEmailTemplateProps {
    header: string;
    content: string;
    previewText: string;
}

export default function MarkdownEmailTemplate({
    header = 'Gredice Newsletter',
    content = 'Markdown **email** content goes here.',
    previewText,
}: MarkdownEmailTemplateProps) {
    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <ContentCard>
                    <Section className="text-center">
                        <GrediceLogotype />
                    </Section>
                    <Section>
                        <Header>{header}</Header>
                    </Section>
                    <Markdown>{content}</Markdown>
                    <Divider className="my-[26px]" />
                    <Disclaimer>
                        Ovaj email je poslan pretplatniku na newsletter Gredice.
                        Ova poruka poslana je automatski. Na ovu adresu nije
                        moguće zaprimati odgovore. Ako imaš pitanja, molimo
                        kontaktiraj nas drugim kanalima. Ukoliko se želiš
                        odjaviti, kontaktiraj nas na{' '}
                        <Link href="mailto:info@gredice.com">
                            info@gredice.com
                        </Link>
                        , <Link href="https://gredice.link/wa">WhatsApp</Link>
                        {' ili '}
                        <Link href="https://gredice.link/ig">Instagram</Link>.
                    </Disclaimer>
                </ContentCard>
            </Tailwind>
        </Html>
    );
}
