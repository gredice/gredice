import { Identify } from "flags";
import { dedupe, flag } from "flags/next";
import { Context } from "./generated/hypertune";

export async function getContext() {
    return {
        environment: process.env.NODE_ENV
    };
}

export const identify = dedupe((async () => {
    return await getContext();
}) satisfies Identify<Context>);