/** Indicative number of sunflowers one euro of balance stands for. */
export const sunflowersPerEuro = 1000;

/** The one wording public pages use for the indicative euro to sunflower rate. */
export const sunflowerRateLabel = `1 € ≈ ${new Intl.NumberFormat('hr-HR').format(sunflowersPerEuro)} suncokreta`;
