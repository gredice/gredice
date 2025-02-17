import 'server-only';

import { storage } from "..";

export async function getFarms() {
    return storage.query.farms.findMany();
}
