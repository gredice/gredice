import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { AttributeDefinitionsList } from "./AttributeDefinitionsList";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { getEntityTypeByName } from "@gredice/storage";
import { KnownPages } from "../../../../../src/KnownPages";
import { notFound } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function AttributesPage({ params }: { params: Promise<{ entityType: string }> }) {
    const { entityType: entityTypeName } = await params;
    const entityType = await getEntityTypeByName(entityTypeName);
    if (!entityType) {
        return notFound();
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <Breadcrumbs items={[
                        { label: entityType.label, href: KnownPages.DirectoryEntityType(entityTypeName) },
                        { label: "Atributi" },
                    ]} />
                </CardTitle>
            </CardHeader>
            <CardContent>
                <AttributeDefinitionsList entityTypeName={entityTypeName} />
            </CardContent>
        </Card>
    );
}