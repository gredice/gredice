# Plant Health Directory Coverage

Generated: 2026-06-04T10:20:51.355Z
Mode: apply

## Source Notes

This first-release dataset imports only source-backed disease and pest entries that map to current published Gredice plant and operation entities. Broad host ranges are narrowed to current Gredice plants named by the reviewed sources.

- umnTomatoLeafSpots: [University of Minnesota Extension tomato leaf spot diseases](https://extension.umn.edu/plant-diseases/tomato-leaf-spot-diseases)
- umnEarlyBlightTomatoPotato: [University of Minnesota Extension early blight in tomato and potato](https://extension.umn.edu/node/2681)
- ucIpmPowderyMildewVegetables: [UC IPM Powdery Mildew on Vegetables](https://ipm.ucanr.edu/m/pn7406-0.html)
- ucIpmAphids: [UC IPM Aphids Pest Notes](https://ipm.ucanr.edu/home-and-landscape/aphids)
- umnSlugs: [University of Minnesota Extension slugs in home gardens](https://extension.umn.edu/yard-and-garden-insects/slugs)
- ucIpmWhiteflies: [UC IPM Whiteflies Pest Notes](https://ipm.ucanr.edu/home-and-landscape/whiteflies/pest-notes)

## Import Summary

- Dataset issues: 5
- Created issue entities this run: 0
- Issue entities with field/ref changes planned or written: 0
- Missing referenced plant names: 0
- Missing referenced operation names: 0
- Published plants with disease coverage: 15
- Published plants with pest coverage: 16

## Missing References

Plants:

- None

Operations:

- None

## Dataset Issues

### Rana plamenjača rajčice (#630)

- Kind: disease
- Affected plants: Rajčica (#7)
- Helpful operations: applyTomatoResiliencePreparation (#569), hygiene-pruning (#319), plantRemoval (#346)
- Sources: University of Minnesota Extension early blight in tomato and potato; University of Minnesota Extension tomato leaf spot diseases
- Fields/refs changed: 0
- Existing refs skipped: 4

### Pepelnica povrća (#631)

- Kind: disease
- Affected plants: Artičoka (#432), Grah (#153), Cikla (#163), Mrkva (#3), Krastavac (#150), Patlidžan (#4), Salata (#156), Dinja (#429), Grašak (#237), Paprika (#2), Rajčica (#7), Repa (#286), Rotkvica (#158), Tikva (#399), Tikvice (#151)
- Helpful operations: hygiene-pruning (#319)
- Sources: UC IPM Powdery Mildew on Vegetables
- Review notes: Host list is limited to current published Gredice plants explicitly covered by the UC IPM vegetable host list.
- Fields/refs changed: 0
- Existing refs skipped: 16

### Lisne uši (#632)

- Kind: pest
- Affected plants: Bosiljak (#287), Brokula (#161), Cvjetača (#160), Čili (#463), Grah (#153), Grašak (#237), Jagoda (#551), Kelj (#155), Kelj pupčar (#512), Krastavac (#150), Kupus (#154), Mahuna (#152), Paprika (#2), Rajčica (#7), Salata (#156)
- Helpful operations: applyPestProtectionPreparation (#571), rinsePestsFromPlant (#583), applyPestProtectionPreparation (#571)
- Sources: UC IPM Aphids Pest Notes
- Fields/refs changed: 0
- Existing refs skipped: 18

### Puževi (#633)

- Kind: pest
- Affected plants: Bosiljak (#287), Grah (#153), Jagoda (#551), Kupus (#154), Mahuna (#152), Salata (#156)
- Helpful operations: applySlugProtectionPreparation (#570), applySlugProtectionPreparation (#570)
- Sources: University of Minnesota Extension slugs in home gardens
- Fields/refs changed: 0
- Existing refs skipped: 8

### Bijela mušica (#634)

- Kind: pest
- Affected plants: Čili (#463), Krastavac (#150), Paprika (#2), Patlidžan (#4), Rajčica (#7)
- Helpful operations: applyPestProtectionPreparation (#571), rinsePestsFromPlant (#583), applyPestProtectionPreparation (#571)
- Sources: UC IPM Whiteflies Pest Notes
- Fields/refs changed: 0
- Existing refs skipped: 8
