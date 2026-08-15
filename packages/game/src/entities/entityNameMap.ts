import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { ArrowSign } from './ArrowSign';
import { BaleHey } from './BaleHey';
import { BeachBall } from './BeachBall';
import { BeachChair } from './BeachChair';
import { BeachTowelStriped } from './BeachTowelStriped';
import { BeachUmbrella } from './BeachUmbrella';
import { BirdHouse } from './BirdHouse';
import { BlockDryGround } from './BlockDryGround';
import { BlockDryGroundAngle } from './BlockDryGroundAngle';
import { BlockGrass } from './BlockGrass';
import { BlockGrassAngle } from './BlockGrassAngle';
import { BlockGround } from './BlockGround';
import { BlockGroundAngle } from './BlockGroundAngle';
import { BlockSand } from './BlockSand';
import { BlockSandAngle } from './BlockSandAngle';
import { BlockSnow } from './BlockSnow';
import { BlockSnowAngle } from './BlockSnowAngle';
import { BlockSnowFalling } from './BlockSnowFalling';
import { BlockSwampGround } from './BlockSwampGround';
import { BlockSwampGroundAngle } from './BlockSwampGroundAngle';
import {
    BlockGrassCorner,
    BlockGroundCorner,
    BlockSandCorner,
    BlockSnowCorner,
} from './BlockTerrainCorner';
import {
    BlockGrassReverseCorner,
    BlockGroundReverseCorner,
    BlockSandReverseCorner,
    BlockSnowReverseCorner,
} from './BlockTerrainReverseCorner';
import { BlockTerrainVariationAsset } from './BlockTerrainVariationAsset';
import { BlockWater } from './BlockWater';
import { Bucket } from './Bucket';
import { Bush } from './Bush';
import { Cactus } from './Cactus';
import { CatPillow } from './CatPillow';
import { Composter } from './Composter';
import { DeadTree } from './DeadTree';
import { DesertStone } from './DesertStone';
import { DogHouse } from './DogHouse';
import { DoubleGardenLightPole } from './DoubleGardenLightPole';
import { EnamelGardenLamp } from './EnamelGardenLamp';
import { Fence } from './Fence';
import { FireflyJar } from './FireflyJar';
import { FishingBoat } from './FishingBoat';
import { GardenBox } from './GardenBox';
import { GiftBoxBlueWhite } from './GiftBoxBlueWhite';
import { GiftBoxGoldRed } from './GiftBoxGoldRed';
import { GiftBoxGreenGold } from './GiftBoxGreenGold';
import { GiftBoxPurpleSilver } from './GiftBoxPurpleSilver';
import { GiftBoxRedWhite } from './GiftBoxRedWhite';
import { GiftBoxWhiteGreen } from './GiftBoxWhiteGreen';
import { HazelLightArch } from './HazelLightArch';
import { IceCreamCart } from './IceCreamCart';
import { InflatablePoolSmall } from './InflatablePoolSmall';
import { LemonadeStand } from './LemonadeStand';
import { LiquidPreparationBottle } from './LiquidPreparationBottle';
import { MoonRainBarrel } from './MoonRainBarrel';
import { OutletDisplayTable } from './OutletDisplayTable';
import { PaintRoller } from './PaintRoller';
import { PalmTree } from './PalmTree';
import { Pine } from './Pine';
import { PineAdvent } from './PineAdvent';
import { PolishedStoneFence } from './PolishedStoneFence';
import { Pot } from './Pot';
import { RaisedBed } from './RaisedBed';
import { RoofTileLantern } from './RoofTileLantern';
import { MulchCoconut } from './raisedBed/MulchCoconut';
import { MulchHey } from './raisedBed/MulchHey';
import { MulchWood } from './raisedBed/MulchWood';
import { Seed } from './raisedBed/Seed';
import { Stick } from './raisedBed/Stick';
import { SandcastleSmallA } from './SandcastleSmall';
import { Shade } from './Shade';
import { ShovelSmall } from './ShovelSmall';
import { SmallWoodenBridge } from './SmallWoodenBridge';
import { Snowman } from './Snowman';
import { StoneFence } from './StoneFence';
import { StoneLarge } from './StoneLarge';
import { StoneMedium } from './StoneMedium';
import { StoneSmall } from './StoneSmall';
import { StoneWalkway } from './StoneWalkway';
import { Stool } from './Stool';
import { SummerHat } from './SummerHat';
import { Sunflower } from './Sunflower';
import { Tree } from './Tree';
import { Tulip } from './Tulip';
import { WateringCan } from './WateringCan';
import { WaterWell } from './WaterWell';
import { WhiteFence } from './WhiteFence';
import { WickerGardenLantern } from './WickerGardenLantern';
import { WoodenBench } from './WoodenBench';
import { WoodenHandLantern } from './WoodenHandLantern';
import { WoodenSign } from './WoodenSign';
import { WoodenWalkway } from './WoodenWalkway';

export const entityNameMap = {
    Block_Ground: BlockGround,
    Block_Grass: BlockGrass,
    Block_Sand: BlockSand,
    Block_Water: BlockWater,
    Block_Swamp_Water: BlockWater,
    Block_Dry_Ground: BlockDryGround,
    Block_Dry_Ground_Angle: BlockDryGroundAngle,
    Block_Swamp_Ground: BlockSwampGround,
    Block_Swamp_Ground_Angle: BlockSwampGroundAngle,
    Block_Stone: BlockTerrainVariationAsset,
    Block_Stone_Angle: BlockTerrainVariationAsset,
    Block_Gravel: BlockTerrainVariationAsset,
    Block_Gravel_Angle: BlockTerrainVariationAsset,
    Block_Stone_Stairs: BlockTerrainVariationAsset,
    Block_Stone_Stairs_Corner: BlockTerrainVariationAsset,
    Block_Stone_Stairs_Half: BlockTerrainVariationAsset,
    Block_Polished_Stone: BlockTerrainVariationAsset,
    Block_Polished_Stone_Angle: BlockTerrainVariationAsset,
    Block_Polished_Stone_Stairs: BlockTerrainVariationAsset,
    Block_Polished_Stone_Stairs_Corner: BlockTerrainVariationAsset,
    Block_Ground_Angle: BlockGroundAngle,
    Block_Grass_Angle: BlockGrassAngle,
    Block_Sand_Angle: BlockSandAngle,
    Block_Ground_Corner: BlockGroundCorner,
    Block_Grass_Corner: BlockGrassCorner,
    Block_Sand_Corner: BlockSandCorner,
    Block_Ground_Reverse_Corner: BlockGroundReverseCorner,
    Block_Grass_Reverse_Corner: BlockGrassReverseCorner,
    Block_Sand_Reverse_Corner: BlockSandReverseCorner,
    Block_Snow: BlockSnow,
    Block_Snow_Angle: BlockSnowAngle,
    Block_Snow_Corner: BlockSnowCorner,
    Block_Snow_Reverse_Corner: BlockSnowReverseCorner,
    Block_Snow_Falling: BlockSnowFalling,
    Composter: Composter,
    Raised_Bed: RaisedBed,
    Shade: Shade,
    BeachUmbrella: BeachUmbrella,
    Fence: Fence,
    WhiteFence: WhiteFence,
    StoneFence: StoneFence,
    PolishedStoneFence: PolishedStoneFence,
    GardenBox: GardenBox,
    Stool: Stool,
    Bucket: Bucket,
    WateringCan: WateringCan,
    LiquidPreparationBottlePestControl: LiquidPreparationBottle,
    LiquidPreparationBottleAphidControl: LiquidPreparationBottle,
    LiquidPreparationBottleSlugControl: LiquidPreparationBottle,
    LiquidPreparationBottleTomatoEggplantResistance: LiquidPreparationBottle,
    LiquidPreparationBottleFertilizer: LiquidPreparationBottle,
    LiquidPreparationBottleDiseaseControl: LiquidPreparationBottle,
    LiquidPreparationBottleWeevilControl: LiquidPreparationBottle,
    LiquidPreparationBottleVoleControl: LiquidPreparationBottle,
    LiquidPreparationBottleBeetleControl: LiquidPreparationBottle,
    PaintRoller: PaintRoller,
    WaterWell: WaterWell,
    WoodenBench: WoodenBench,
    OutletDisplayTable: OutletDisplayTable,
    LemonadeStand: LemonadeStand,
    IceCreamCart: IceCreamCart,
    SummerHat: SummerHat,
    BeachTowelStriped: BeachTowelStriped,
    InflatablePoolSmall: InflatablePoolSmall,
    BeachChair: BeachChair,
    PalmTree: PalmTree,
    BeachBall: BeachBall,
    SandcastleSmallA: SandcastleSmallA,
    BirdHouse: BirdHouse,
    ArrowSignWhiteLeft: ArrowSign,
    ArrowSignRedLeft: ArrowSign,
    ArrowSignBlueLeft: ArrowSign,
    ArrowSignGreenLeft: ArrowSign,
    ArrowSignWoodLeft: ArrowSign,
    ArrowSignWhiteRight: ArrowSign,
    ArrowSignRedRight: ArrowSign,
    ArrowSignBlueRight: ArrowSign,
    ArrowSignGreenRight: ArrowSign,
    ArrowSignWoodRight: ArrowSign,
    ArrowSignWhiteUp: ArrowSign,
    ArrowSignRedUp: ArrowSign,
    ArrowSignBlueUp: ArrowSign,
    ArrowSignGreenUp: ArrowSign,
    ArrowSignWoodUp: ArrowSign,
    ArrowSignWhiteDown: ArrowSign,
    ArrowSignRedDown: ArrowSign,
    ArrowSignBlueDown: ArrowSign,
    ArrowSignGreenDown: ArrowSign,
    ArrowSignWoodDown: ArrowSign,
    WoodenSign: WoodenSign,
    CatPillow: CatPillow,
    Cat_Pillow: CatPillow,
    DogHouse: DogHouse,
    SmallWoodenBridge: SmallWoodenBridge,
    WoodenWalkway: WoodenWalkway,
    StoneWalkway: StoneWalkway,
    FishingBoat: FishingBoat,
    FireflyJar: FireflyJar,
    EnamelGardenLamp: EnamelGardenLamp,
    DoubleGardenLightPole: DoubleGardenLightPole,
    HazelLightArch: HazelLightArch,
    RoofTileLantern: RoofTileLantern,
    WickerGardenLantern: WickerGardenLantern,
    WoodenHandLantern: WoodenHandLantern,
    MoonRainBarrel: MoonRainBarrel,
    GiftBox_RedWhite: GiftBoxRedWhite,
    GiftBox_GreenGold: GiftBoxGreenGold,
    GiftBox_BlueWhite: GiftBoxBlueWhite,
    GiftBox_PurpleSilver: GiftBoxPurpleSilver,
    GiftBox_GoldRed: GiftBoxGoldRed,
    GiftBox_WhiteGreen: GiftBoxWhiteGreen,
    Bush: Bush,
    Tree: Tree,
    Pine: Pine,
    DeadTreeTall: DeadTree,
    DeadTreeStump: DeadTree,
    PineAdvent: PineAdvent,
    StoneSmall: StoneSmall,
    StoneMedium: StoneMedium,
    StoneLarge: StoneLarge,
    DesertStoneSmall: DesertStone,
    DesertStoneMedium: DesertStone,
    DesertStoneLarge: DesertStone,
    ShovelSmall: ShovelSmall,
    Snowman: Snowman,
    Tulip: Tulip,
    Sunflower: Sunflower,
    CactusBarrel: Cactus,
    CactusColumnCluster: Cactus,
    CactusPricklyPear: Cactus,
    BaleHey: BaleHey,
    PotLowBowl: Pot,
    PotRoundedBowl: Pot,
    PotBulbousNeck: Pot,
    PotTallTapered: Pot,
    PotHourglass: Pot,
    PotStraightShortTub: Pot,
    PotNarrowFootBowl: Pot,
    PotSquatRidged: Pot,
    PotTallSlenderCone: Pot,
    PotWideLippedCup: Pot,

    // Raised bed items
    MulchHey: MulchHey,
    MulchCoconut: MulchCoconut,
    MulchWood: MulchWood,
    Stick: Stick,
    Seed: Seed,
} satisfies Record<string, React.ComponentType<EntityInstanceProps>>;

export type EntityName = keyof typeof entityNameMap;
