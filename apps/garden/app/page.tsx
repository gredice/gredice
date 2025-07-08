import { SignedOut } from "@signalco/auth-client/components";
import LoginModal from "../components/auth/LoginModal";
import { GameSceneDynamic } from "./GameSceneDynamic";
import { enableDebugHudFlag, enableRaisedBedDiaryFlag, enableRaisedBedFieldDiaryFlag, enableRaisedBedFieldOperationsFlag, enableRaisedBedFieldWateringFlag, enableRaisedBedOperationsFlag, enableRaisedBedWateringFlag } from "./flags";
import { ComponentProps } from "react";

export default async function Home() {
  const flags: ComponentProps<typeof GameSceneDynamic>["flags"] = {
    enableDebugHudFlag: await enableDebugHudFlag(),
    enableDebugCloseupFlag: await enableDebugHudFlag(),
    enableRaisedBedWateringFlag: await enableRaisedBedWateringFlag(),
    enableRaisedBedDiaryFlag: await enableRaisedBedDiaryFlag(),
    enableRaisedBedOperationsFlag: await enableRaisedBedOperationsFlag(),
    enableRaisedBedFieldOperationsFlag: await enableRaisedBedFieldOperationsFlag(),
    enableRaisedBedFieldWateringFlag: await enableRaisedBedFieldWateringFlag(),
    enableRaisedBedFieldDiaryFlag: await enableRaisedBedFieldDiaryFlag(),
  };

  return (
    <div className="grid grid-cols-1 h-[100dvh] relative overflow-hidden">
      <GameSceneDynamic flags={flags} />
      <SignedOut>
        <LoginModal />
      </SignedOut>
    </div>
  );
}
