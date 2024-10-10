import { getEntityTypes } from "@gredice/storage";
import { Card } from "@signalco/ui-primitives/Card";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import Link from "next/link";

export default async function DirectoriesLayout({ children }: { children: React.ReactNode }) {
    const entityTypes = await getEntityTypes();

    return (
        <Row alignItems="start" spacing={2} className="p-4">
            <Card>
                {entityTypes.map(et => (
                    <Link href={`/admin/directories/${et.name}`} key={et.id}>
                        <Typography>{et.label}</Typography>
                    </Link>
                ))}
            </Card>
            <div className="grow">
                {children}
            </div>
        </Row>
    );
}