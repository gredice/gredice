import { getEntityTypes } from "@gredice/storage";
import { Row } from "@signalco/ui-primitives/Row";
import { createEntityType } from "../../(actions)/entityActions";
import { EntityTypesList } from "./EntityTypesList";

export const dynamic = 'force-dynamic';

export default async function DirectoriesLayout({ children }: { children: React.ReactNode }) {
    const entityTypes = await getEntityTypes();

    return (
        <Row alignItems="start" spacing={2} className="p-4">
            <EntityTypesList entityTypes={entityTypes} createEntityType={createEntityType} />
            <div className="grow">
                {children}
            </div>
        </Row>
    );
}