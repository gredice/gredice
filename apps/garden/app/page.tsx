import { SignedOut } from "@signalco/auth-client/components";
import LoginModal from "../components/auth/LoginModal";
import getHypertune from "../lib/flags/getHypertune";
import { GameSceneDynamic } from "./GameSceneDynamic";

export default async function Home() {
  const hypertune = await getHypertune();
  const enableDebugHud = hypertune.enableDebugHud({ fallback: false });

  return (
    <div className="grid grid-cols-1 h-screen relative">
      <GameSceneDynamic isDevelopment={enableDebugHud} />
      <SignedOut>
        <LoginModal />
      </SignedOut>
    </div>
  );
}
