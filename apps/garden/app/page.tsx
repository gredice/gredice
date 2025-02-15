import { SignedIn, SignedOut } from "@signalco/auth-client/components";
import LoginModal from "../components/auth/LoginModal";
// import getHypertune from "../lib/flags/getHypertune";
import { GameSceneDynamic } from "./GameSceneDynamic";
import { WelcomeMessage } from "../components/WelcomeMessage";

export default async function Home() {
  const enableDebugHud = false//(await getHypertune()).enableDebugHud({ fallback: false });

  return (
    <div className="grid grid-cols-1 h-[100dvh] relative">
      <SignedIn>
        <GameSceneDynamic isDevelopment={enableDebugHud} />
        <WelcomeMessage />
      </SignedIn>
      <SignedOut>
        <LoginModal />
      </SignedOut>
    </div>
  );
}
