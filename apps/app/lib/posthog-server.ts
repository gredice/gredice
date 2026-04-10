import { getPostHog } from '@posthog/next';

type PostHogCaptureClient = Pick<
    Awaited<ReturnType<typeof getPostHog>>,
    'capture'
>;

const noopPostHogClient: PostHogCaptureClient = {
    capture: () => undefined,
};

export async function getPostHogClient(): Promise<PostHogCaptureClient> {
    const apiKey =
        process.env.NEXT_PUBLIC_POSTHOG_KEY ??
        process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

    if (!apiKey) {
        return noopPostHogClient;
    }

    return getPostHog(apiKey);
}
