import { hc } from "hono/client";

import { AppType } from "@gredice/api/routes";
import { getAppUrl, getAuthHeaders } from "./shared";

function clientAuth() {
    if (typeof localStorage === 'undefined') {
        return {};
    }

    return {
        headers: {
            authorization: getAuthHeaders() ?? ''
        }
    };
}

export const client = () => hc<AppType>(getAppUrl(), {
    ...clientAuth()
});