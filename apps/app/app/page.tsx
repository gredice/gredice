import { GameScene } from "@/components/game/GameScene";
import { CSSProperties } from "react";

export default function Home() {
  return (
    <div
      className="grid grid-cols-1 h-screen bg-[#E7E2CC]"
      style={{ '--section-bg': '#E7E2CC' } as CSSProperties}>
      <GameScene />
    </div>
  );
}
