import {
    Head,
    Html,
    Markdown,
    Preview,
    Section,
    Tailwind,
} from '@react-email/components';
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
                        Ukoliko ne želiš primati ovakve emailove, ukoliko se
                        želiš odjaviti možeš to učiniti tako da nas kontaktiraš
                        na{' '}
                        <Link href="mailto:info@gredice.com">
                            info@gredice.com
                        </Link>
                        .
                    </Disclaimer>
                </ContentCard>
            </Tailwind>
        </Html>
    );
}
