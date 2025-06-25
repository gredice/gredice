import { SignedOut } from "@signalco/auth-client/components";
import LoginModal from "../components/auth/LoginModal";
import { GameSceneDynamic } from "./GameSceneDynamic";
import { enableDebugHudFlag } from "./flags";
import { ComponentProps } from "react";

export default async function Home() {
  const flags: ComponentProps<typeof GameSceneDynamic>["flags"] = {
    enableDebugHudFlag: await enableDebugHudFlag(),
    enableDebugCloseupFlag: await enableDebugHudFlag(),
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
