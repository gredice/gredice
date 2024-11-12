import { Avatar } from "@signalco/ui-primitives/Avatar";
import { HudCard } from "./components/HudCard";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";

function SunflowersAmount() {
    return (
        <div className="flex flex-row gap-1 items-center border rounded-full pl-1 pr-2">
            <span className="text-xl">🌻</span>
            <Typography level="body2">100</Typography>
        </div>
    );
}

export function AccountHud() {
    return (
        <HudCard position='floating' open className="left-4 top-4 p-1 pr-2">
            <Row spacing={1}>
                <Avatar>
                    AT
                </Avatar>
                <SunflowersAmount />
            </Row>
        </HudCard>
    );
}