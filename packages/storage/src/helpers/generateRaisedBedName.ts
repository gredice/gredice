export function generateRaisedBedName() {
    // Adjectives by gender
    const adjectives: { m: string[]; f: string[]; n: string[] } = {
        m: [
            "Veseli",   // cheerful
            "Šareni",   // colorful
            "Brzi",     // fast
            "Mali",     // little
            "Veliki",   // big
            "Snažni",   // strong
            "Sretni",   // happy
            "Zlatni",   // golden
            "Pametni",  // smart
            "Hrabri",   // brave
            "Zabavni",  // fun
            "Slatki",   // sweet
            "Mirisni",  // fragrant
            "Sunčani",  // sunny
            "Plavi",    // blue
            "Zeleni",   // green
            "Ljubičasti", // purple
            "Plavi",    // blue
            "Zeleni",   // green
            "Ljupki",  // lovely
            "Čarobni"   // magical
        ],
        f: [
            "Vesela",   // cheerful
            "Šarena",   // colorful
            "Brza",     // fast
            "Mala",     // little
            "Velika", // big
            "Snažna", // strong
            "Sretna",   // happy
            "Zlatna",   // golden
            "Pametna",  // smart
            "Hrabra",   // brave
            "Zabavna",  // fun
            "Slatka",   // sweet
            "Mirisna",  // fragrant
            "Sunčana",  // sunny
            "Plava",    // blue
            "Zelena",   // green
            "Ljubičasta", // purple
            "Zelena",   // green
            "Ljupka",   // lovely
            "Čarobna"   // magical
        ],
        n: [
            "Veselo",   // cheerful
            "Šareno",   // colorful
            "Brzo",     // fast
            "Malo",     // little
            "Veliko",   // big
            "Snažno",   // strong
            "Sretno",   // happy
            "Zlatno",   // golden
            "Pametno",  // smart
            "Hrabro",   // brave
            "Zabavno",  // fun
            "Slatko",   // sweet
            "Mirisno",  // fragrant
            "Sunčano",  // sunny
            "Plavo",    // blue
            "Zeleno",   // green
            "Ljubičasto", // purple
            "Zeleno",   // green
            "Ljupko",   // lovely
            "Čarobno"   // magical
        ]
    };
    // Nouns with gender: m (masculine), f (feminine), n (neuter)
    type Gender = keyof typeof adjectives;
    const nouns: { word: string; gender: Gender }[] = [
        { word: "Bubamara", gender: "f" },   // ladybug
        { word: "Pčelica", gender: "f" },    // little bee
        { word: "Zvončić", gender: "m" },    // bellflower
        { word: "Leptir", gender: "m" },     // butterfly
        { word: "Zeko", gender: "m" },       // bunny
        { word: "Medo", gender: "m" },       // teddy bear
        { word: "Cvjetić", gender: "m" },    // little flower
        { word: "Listić", gender: "m" },     // little leaf
        { word: "Suncokret", gender: "m" },  // sunflower
        { word: "Kornjača", gender: "f" },   // turtle
        { word: "Vjeverica", gender: "f" },  // squirrel
        { word: "Ribica", gender: "f" },     // little fish
        { word: "Jabuka", gender: "f" },     // apple
        { word: "Trešnja", gender: "f" },    // cherry
        { word: "Pahuljica", gender: "f" },  // snowflake
        { word: "Bor", gender: "m" },        // pine
        { word: "Jelka", gender: "f" },     // fir
        { word: "Trava", gender: "f" },     // grass
        { word: "Oblak", gender: "m" },     // cloud
        { word: "Zrak", gender: "m" },      // air
        { word: "Vjetar", gender: "m" },    // wind
        { word: "Kiša", gender: "f" },      // rain
        { word: "Snijeg", gender: "f" },    // snow
        { word: "Zvijezda", gender: "f" },  // star
        // Neuter nouns
        { word: "Sunce", gender: "n" },      // sun
        { word: "More", gender: "n" },       // sea
        { word: "Srce", gender: "n" },       // heart
        { word: "Jaje", gender: "n" },       // egg
        { word: "Stablo", gender: "n" },     // tree
    ];
    const nounObj = nouns[Math.floor(Math.random() * nouns.length)];
    const adjList = adjectives[nounObj.gender];
    const adj = adjList[Math.floor(Math.random() * adjList.length)];
    return `${adj} ${nounObj.word}`;
}
