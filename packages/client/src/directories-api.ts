import createClient from "openapi-fetch";
import { getAppUrl } from "./shared";
import { paths } from "./lib/directories-api/v1";

export function directoriesClient() {
    return createClient<paths>({ baseUrl: getAppUrl() + "/api/directories" });
}

export type PlantData = paths["/entities/plant"]["get"]["responses"]["200"]["content"]["application/json"][0];
export type BlockData = paths["/entities/block"]["get"]["responses"]["200"]["content"]["application/json"][0];
export type OperationData = paths["/entities/operation"]["get"]["responses"]["200"]["content"]["application/json"][0];
export type FaqData = paths["/entities/faq"]["get"]["responses"]["200"]["content"]["application/json"][0];
export type PlantSortData = paths["/entities/plantSort"]["get"]["responses"]["200"]["content"]["application/json"][0];