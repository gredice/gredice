import { Identify } from "flags";
import { dedupe, flag } from "flags/next";
import { Context } from "./generated/hypertune";
import { client } from "@gredice/client";

export async function getContext() {
    // Your own logic to identify the user
    // Identifying the user should rely on reading cookies and headers only, and
    // not make any network requests, as it's important to keep latency low here.
    const response = await client().api.users.current.$get();
    if (!response.ok) {
        return {
            user: {
                email: 'unknown',
                id: 'unknown',
                name: 'unknown',
            },
            environment: process.env.NODE_ENV
        };
    }
    const user = await response.json();

    return {
        user: {
            email: user?.userName,
            id: user?.id,
            name: user?.displayName,
        },
        environment: process.env.NODE_ENV
    };
}

export const identify = dedupe((async () => {
    return await getContext();
}) satisfies Identify<Context>);