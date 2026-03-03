import 'server-only';

type FacebookCapiUserData = {
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string;
    fbp?: string;
};

type FacebookCapiEvent = {
    event_id?: string;
    event_name: string;
    event_source_url?: string;
    user_data: FacebookCapiUserData;
};

const FACEBOOK_GRAPH_VERSION = process.env.FACEBOOK_CAPI_API_VERSION ?? 'v23.0';

function getFacebookCapiConfig() {
    const accessToken = process.env.FACEBOOK_CAPI_TOKEN;
    const pixelId = process.env.FACEBOOK_CAPI_PIXEL_ID;

    if (!accessToken || !pixelId) {
        return null;
    }

    return {
        accessToken,
        pixelId,
    };
}

export async function sendFacebookCapiEvent(event: FacebookCapiEvent) {
    const config = getFacebookCapiConfig();

    if (!config) {
        return;
    }

    const endpoint = `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/${config.pixelId}/events?access_token=${config.accessToken}`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                data: [
                    {
                        event_name: event.event_name,
                        event_time: Math.floor(Date.now() / 1000),
                        action_source: 'website',
                        event_source_url: event.event_source_url,
                        event_id: event.event_id,
                        user_data: event.user_data,
                    },
                ],
            }),
        });

        if (!response.ok) {
            console.error('Failed to send Facebook CAPI event', {
                status: response.status,
                statusText: response.statusText,
                eventName: event.event_name,
                eventId: event.event_id,
            });
        }
    } catch (error) {
        console.error('Error sending Facebook CAPI event', {
            error,
            eventName: event.event_name,
            eventId: event.event_id,
        });
    }
}
