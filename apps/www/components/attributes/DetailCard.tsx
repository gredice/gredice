import { Card } from "@signalco/ui-primitives/Card";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import {ReactNode} from "react";

export function AttributeCard({ icon, header, value }: { icon: ReactNode; header: string; value: string | null | undefined }) {
    return (
        <Card className="flex items-center">
            <Row spacing={2}>
                <div className="flex-shrink-0 ml-2 text-primary">{icon}</div>
                <div>
                    <Typography level="body2" component="h4">{header}</Typography>
                    <Typography semiBold>{value ?? '-'}</Typography>
                </div>
            </Row>
        </Card>
    )
}