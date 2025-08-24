export interface OAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string;
    authUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
}

function getGoogleSecrets() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('Missing Google OAuth secrets');
    }

    return {
        clientId,
        clientSecret,
    };
}

function getFacebookSecrets() {
    const clientId = process.env.FACEBOOK_CLIENT_ID;
    const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('Missing Facebook OAuth secrets');
    }

    return {
        clientId,
        clientSecret,
    };
}

export const oauthConfigs = {
    google: {
        ...getGoogleSecrets(),
        redirectUri: `https://api.gredice.com/api/auth/google/callback`,
        scope: 'openid email profile',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    },
    facebook: {
        ...getFacebookSecrets(),
        redirectUri: `https://api.gredice.com/api/auth/facebook/callback`,
        scope: 'email,public_profile',
        authUrl: 'https://www.facebook.com/v23.0/dialog/oauth',
        tokenUrl: 'https://graph.facebook.com/v23.0/oauth/access_token',
        userInfoUrl: 'https://graph.facebook.com/me?fields=id,name,email',
    },
} as const;

export function generateAuthUrl(
    provider: keyof typeof oauthConfigs,
    state: string,
) {
    const config = oauthConfigs[provider];
    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: config.scope,
        response_type: 'code',
        state,
    });

    return `${config.authUrl}?${params.toString()}`;
}

export async function exchangeCodeForToken(
    provider: keyof typeof oauthConfigs,
    code: string,
) {
    const config = oauthConfigs[provider];

    const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: config.redirectUri,
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to exchange code for token');
    }

    return await response.json();
}

export async function fetchUserInfo(
    provider: keyof typeof oauthConfigs,
    accessToken: string,
) {
    const config = oauthConfigs[provider];

    const response = await fetch(config.userInfoUrl, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch user info');
    }

    const data = await response.json();

    // Normalize user data across providers
    if (provider === 'google') {
        return {
            id: data.id,
            name: data.name,
            email: data.email,
        };
    } else if (provider === 'facebook') {
        return {
            id: data.id,
            name: data.name,
            email: data.email,
        };
    }

    return data;
}
