import { SectionsView } from "@signalco/cms-core/SectionsView";
import { sectionsComponentRegistry } from "../components/shared/sectionsComponentRegistry";
import { Navigate } from "@signalco/ui-icons";
import { KnownPages } from "../src/KnownPages";
import { GameScene } from "@gredice/game/GameScene";
import { SectionData } from "@signalco/cms-core/SectionData";

const sectionsData: SectionData[] = [
    {
        component: 'Heading1',
        tagline: 'Gredice',
        header: 'Vrt po tvom',
        description: 'Dobiješ povrćeg iz gredicama - nit oro, nit kopo!',
        asset: (
            <div className="min-h-96 relative rounded-xl overflow-hidden">
                <GameScene
                    className="!absolute"
                    appBaseUrl="https://vrt.gredice.com"
                    freezeTime={new Date(2024, 5, 21, 14)}
                    noBackground />
            </div>
        ),
        ctas: [
            { label: 'Posjeti svoj vrt', href: KnownPages.GardenApp, icon: <Navigate /> }
        ]
    }
];


export default function Home() {
  return (
      <SectionsView
          sectionsData={sectionsData}
          componentsRegistry={sectionsComponentRegistry} />
  );
}
