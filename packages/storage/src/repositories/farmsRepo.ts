import 'server-only';

import { storage } from "..";

export async function getFarms() {
    return await storage.query.farms.findMany();
}
