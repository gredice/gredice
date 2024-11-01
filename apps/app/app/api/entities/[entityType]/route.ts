import { getEntitiesFormatted } from "@gredice/storage";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ entityType: string }> }
) {
    const { entityType: entityTypeName } = await params;
    const entities = await getEntitiesFormatted(entityTypeName);
    return Response.json(entities);
}