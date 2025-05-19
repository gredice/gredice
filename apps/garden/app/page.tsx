import { SignedIn, SignedOut } from "@signalco/auth-client/components";
import LoginModal from "../components/auth/LoginModal";
import { GameSceneDynamic } from "./GameSceneDynamic";
import { enableDebugHudFlag } from "./flags";

export default async function Home() {
  const enableDebugHud = await enableDebugHudFlag();

  return (
    <div className="grid grid-cols-1 h-[100dvh] relative overflow-hidden">
      <SignedIn>
        <GameSceneDynamic isDevelopment={enableDebugHud} />
      </SignedIn>
      <SignedOut>
        <LoginModal />
      </SignedOut>
    </div>
  );
}
