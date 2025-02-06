import { BlockData } from "../../@types/BlockData";
import { apiFetch } from "../utils/apiFetch";

export async function loadBlockData() {
    const resp = await apiFetch('/api/directories/entities/block');
    return await resp.json() as BlockData[];
}