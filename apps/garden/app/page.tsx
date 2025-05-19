import { SignedOut } from "@signalco/auth-client/components";
import LoginModal from "../components/auth/LoginModal";
import { GameSceneDynamic } from "./GameSceneDynamic";
import { enableDebugHudFlag } from "./flags";

export default async function Home() {
  const enableDebugHud = await enableDebugHudFlag();

  return (
    <div className="grid grid-cols-1 h-[100dvh] relative overflow-hidden">
      <GameSceneDynamic isDevelopment={enableDebugHud} />
      <SignedOut>
        <LoginModal />
      </SignedOut>
    </div>
  );
}
