import { getEntitiesFormatted } from "@gredice/storage";
import { NextRequest } from "next/server";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ entityType: string }> }
) {
    const { entityType: entityTypeName } = await params;
    const entities = await getEntitiesFormatted(entityTypeName);
    return Response.json(entities);
}