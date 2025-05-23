import createClient from "openapi-fetch";
import { getAppUrl } from "./shared";
import { paths } from "./lib/directories-api/v1";

export function directoriesClient() {
    return createClient<paths>({ baseUrl: getAppUrl() + "/api/directories" });
}