import { SignedOut } from "@signalco/auth-client/components";
import LoginModal from "../components/auth/LoginModal";
import { GameSceneDynamic } from "./GameSceneDynamic";
import { enableDebugHudFlag, shoppingCartFlag } from "./flags";

export default async function Home() {
  const flags = {
    enableDebugHud: await enableDebugHudFlag(),
    shoppingCartFlag: await shoppingCartFlag(),
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
