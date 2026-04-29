
export interface AssetDepreciation {
  annualDepreciation: number;
  accumulatedDepreciation: number;
  currentValue: number;
}

export function calculateDepreciation(
  purchaseCost: number,
  salvageValue: number,
  usefulLifeYears: number,
  purchaseDate: string | Date,
  method: 'straight_line' | 'wdv' = 'straight_line'
): AssetDepreciation {
  if (usefulLifeYears <= 0 || purchaseCost <= 0) {
    return { annualDepreciation: 0, accumulatedDepreciation: 0, currentValue: purchaseCost };
  }

  const purchase = new Date(purchaseDate);
  const now = new Date();
  
  let yearsUsed = now.getFullYear() - purchase.getFullYear();
  if (yearsUsed < 0) yearsUsed = 0;

  if (method === 'wdv') {
    // For WDV, the rate is 1 - (Salvage / Cost)^(1 / UsefulLife)
    // If salvage is 0, we assume a nominal percentage (e.g. 5%) to calculate a realistic depreciation rate.
    const effectiveSalvage = salvageValue > 0 ? salvageValue : purchaseCost * 0.05;
    const rate = 1 - Math.pow(effectiveSalvage / purchaseCost, 1 / usefulLifeYears);
    
    let currentValue = purchaseCost;
    let accumulatedDepreciation = 0;
    
    // WDV is applied year by year. We calculate up to yearsUsed.
    for (let i = 0; i < yearsUsed; i++) {
       const depForYear = currentValue * rate;
       currentValue -= depForYear;
       accumulatedDepreciation += depForYear;
    }
    
    // The depreciation for the current year would be:
    const annualDepreciation = currentValue * rate;

    // Ensure we do not depreciate below true salvage value
    if (currentValue < salvageValue) {
      accumulatedDepreciation -= (salvageValue - currentValue);
      currentValue = salvageValue;
    }

    return {
      annualDepreciation,
      accumulatedDepreciation,
      currentValue
    };
  }

  // Fallback to straight-line
  const annualDepreciation = (purchaseCost - salvageValue) / usefulLifeYears;
  
  const accumulatedDepreciation = Math.min(
    yearsUsed * annualDepreciation,
    Math.max(0, purchaseCost - salvageValue)
  );
  
  const currentValue = Math.max(purchaseCost - accumulatedDepreciation, salvageValue);

  return {
    annualDepreciation,
    accumulatedDepreciation,
    currentValue
  };
}
