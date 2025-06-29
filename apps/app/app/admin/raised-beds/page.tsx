import { getAllRaisedBeds } from "@gredice/storage";
import { auth } from "../../../lib/auth/auth";
import { RaisedBedsTable } from "./RaisedBedsTable";

export const dynamic = 'force-dynamic';

export default async function RaisedBedsPage() {
    await auth(['admin']);
    const raisedBeds = await getAllRaisedBeds();
    return <RaisedBedsTable raisedBeds={raisedBeds} />;
};