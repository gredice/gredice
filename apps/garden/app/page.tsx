import { GameScene } from "@gredice/game/GameScene";
import getHypertune from "../lib/flags/getHypertune";

export default async function Home() {
  const hypertune = await getHypertune();
  const enableDebugHud = hypertune.enableDebugHud({ fallback: false });

  return (
    <div className="grid grid-cols-1 h-screen">
      <GameScene isDevelopment={enableDebugHud} />
    </div>
  );
}
