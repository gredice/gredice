import { getEntityTypes } from "@gredice/storage";
import { Card } from "@signalco/ui-primitives/Card";
import { Row } from "@signalco/ui-primitives/Row";
import { Avatar } from "@signalco/ui-primitives/Avatar";
import Link from "next/link";
import { initials } from "@signalco/js";
import { Stack } from "@signalco/ui-primitives/Stack";
import { ServerActionIconButton } from "../../../components/shared/ServerActionIconButton";
import { Add } from "@signalco/ui-icons";
import { createEntityType } from "../../(actions)/entityActions";
import { Button } from "@signalco/ui-primitives/Button";
import { Divider } from "@signalco/ui-primitives/Divider";

export const dynamic = 'force-dynamic';

export default async function DirectoriesLayout({ children }: { children: React.ReactNode }) {
    const entityTypes = await getEntityTypes();

    return (
        <Row alignItems="start" spacing={2} className="p-4">
            <Card>
                <Stack>
                {entityTypes.map(et => (
                    <Link href={`/admin/directories/${et.name}`} key={et.id} passHref>
                        <Button fullWidth variant="plain" size="lg">
                            {et.label}
                        </Button>
                    </Link>
                ))}
                    <Divider className="my-2" />
                    <ServerActionIconButton
                        fullWidth
                        title="Dodaj tip zapisa"
                        actionProps={['test']}
                        variant="plain"
                        onClick={createEntityType}>
                        <Add className="size-4" />
                    </ServerActionIconButton>
                </Stack>
            </Card>
            <div className="grow">
                {children}
            </div>
        </Row>
    );
}