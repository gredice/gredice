import { hc } from "hono/client";

import { AppType } from "@gredice/api/routes";

const getAppUrl = () => {
    if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview') {
        return `https://api.gredice.com`;
    } else {
        return `http://localhost:3005`;
    }
}

export function clientAuth() {
    return {
        headers: {
            authorization: `Bearer ${localStorage.getItem('gredice-token')}`
        }
    };
}

export const client = hc<AppType>(getAppUrl(), {
    ...clientAuth()
});