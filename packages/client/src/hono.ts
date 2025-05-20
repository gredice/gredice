import { hc } from "hono/client";

import { AppType } from "@gredice/api/routes";

const getAppUrl = () => {
    if (process.env.NODE_ENV === 'development') {
        return `http://localhost:3005`;
    } else {
        return `https://api.gredice.com`;
    }
}

function clientAuth() {
    if (typeof localStorage === 'undefined') {
        return {};
    }

    return {
        headers: {
            authorization: `Bearer ${localStorage.getItem('gredice-token')}`
        }
    };
}

export const client = () => hc<AppType>(getAppUrl(), {
    ...clientAuth()
});