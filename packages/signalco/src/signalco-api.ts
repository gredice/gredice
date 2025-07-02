import 'server-only';
import createClient from "openapi-fetch";
import { paths } from "./lib/signalco-api/v1";

export function signalcoClient() {
    if (!process.env.SIGNALCO_API_KEY) {
        throw new Error("SIGNALCO_API_KEY environment variable is not set");
    }
    return createClient<paths>({
        baseUrl: "https://api.signalco.io/api",
        headers: {
            Authorization: `Bearer ${process.env.SIGNALCO_API_KEY}`
        }
    });
}
