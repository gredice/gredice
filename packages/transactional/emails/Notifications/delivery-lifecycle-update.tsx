import {
    type CustomerDeliveryNotificationEvent,
    createCustomerDeliveryNotificationContent,
} from '@gredice/notifications/customer-delivery';
import { Head, Html, Preview, Section, Tailwind } from 'react-email';
import { ContentCard } from '../../components/ContentCard';
import { Divider } from '../../components/Divider';
import { GrediceLogotype } from '../../components/GrediceLogotype';
import { Header } from '../../components/Header';
import { Paragraph } from '../../components/Paragraph';
import { PrimaryButton } from '../../components/PrimaryButton';
import { GrediceDisclaimer } from '../../components/shared/GrediceDisclaimer';

export interface DeliveryLifecycleUpdateEmailTemplateProps {
    email: string;
    event: CustomerDeliveryNotificationEvent;
    appName?: string;
    appDomain?: string;
}

export function DeliveryLifecycleUpdateEmailTemplate({
    email,
    event,
    appName = 'Gredice',
    appDomain = 'gredice.com',
}: DeliveryLifecycleUpdateEmailTemplateProps) {
    const content = createCustomerDeliveryNotificationContent(event);
    const previewText = `${appName} - ${content.title}`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <ContentCard>
                    <Section className="text-center">
                        <GrediceLogotype />
                    </Section>
                    <Header>{content.title}</Header>
                    <Paragraph>{content.body}</Paragraph>
                    <Section className="my-[32px] text-center">
                        <PrimaryButton href={content.trackerUrl}>
                            {content.actionLabel}
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

export default DeliveryLifecycleUpdateEmailTemplate;
