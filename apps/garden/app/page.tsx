import { SignedIn, SignedOut } from "@signalco/auth-client/components";
import LoginModal from "../components/auth/LoginModal";
// import getHypertune from "../lib/flags/getHypertune";
import { GameSceneDynamic } from "./GameSceneDynamic";

export default async function Home() {
  const enableDebugHud = false//(await getHypertune()).enableDebugHud({ fallback: false });

  return (
    <div className="grid grid-cols-1 h-[100dvh] relative">
      <SignedIn>
        <GameSceneDynamic isDevelopment={enableDebugHud} />
      </SignedIn>
      <SignedOut>
        <LoginModal />
      </SignedOut>
    </div>
  );
}
