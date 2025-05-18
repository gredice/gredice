import { SignedOut } from "@signalco/auth-client/components";
import LoginModal from "../components/auth/LoginModal";
import getHypertune from "../lib/flags/getHypertune";
import { GameSceneDynamic } from "./GameSceneDynamic";

export default async function Home() {
  const enableDebugHud = (await getHypertune()).enableDebugHud({ fallback: false });

  return (
    <div className="grid grid-cols-1 h-[100dvh] relative overflow-hidden">
      <GameSceneDynamic isDevelopment={enableDebugHud} />
      <SignedOut>
        <LoginModal />
      </SignedOut>
    </div>
  );
}
