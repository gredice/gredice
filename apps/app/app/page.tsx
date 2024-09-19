import { GameScene } from "@/components/game/GameScene";
import { CSSProperties } from "react";

export default function Home() {
  return (
    <div
      className="grid grid-cols-2 h-[80vh] bg-[#E7E2CC]"
      style={{ '--section-bg': '#E7E2CC' } as CSSProperties}>
      <div className="text-4xl font-light text-[#2e6f40] text-center pt-60">Gredice</div>
      <GameScene />
    </div>
  );
}
