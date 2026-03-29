export const TABLE_TIME_OFFER = {
  playedMinutes: 120,
  billedMinutes: 90,
} as const;

export interface TimeChargeBreakdown {
  playedMinutes: number;
  billedMinutes: number;
  discountedMinutes: number;
  timeCost: number;
  offerSelected: boolean;
  offerApplied: boolean;
}

export const calculateBilledMinutes = (playedMinutes: number, applyOffer = false) => {
  const safePlayedMinutes = Math.max(0, Math.round(playedMinutes));
  if (!applyOffer) return safePlayedMinutes;

  const fullOfferBlocks = Math.floor(safePlayedMinutes / TABLE_TIME_OFFER.playedMinutes);
  const remainingMinutes = safePlayedMinutes % TABLE_TIME_OFFER.playedMinutes;

  return (fullOfferBlocks * TABLE_TIME_OFFER.billedMinutes) + remainingMinutes;
};

export const calculateTimeCharge = (
  playedMinutes: number,
  pricePerMinute: number,
  applyOffer = false,
): TimeChargeBreakdown => {
  const safePlayedMinutes = Math.max(0, Math.round(playedMinutes));
  const safePricePerMinute = Number.isFinite(pricePerMinute) ? pricePerMinute : 0;
  const billedMinutes = calculateBilledMinutes(safePlayedMinutes, applyOffer);
  const discountedMinutes = safePlayedMinutes - billedMinutes;

  return {
    playedMinutes: safePlayedMinutes,
    billedMinutes,
    discountedMinutes,
    timeCost: billedMinutes * safePricePerMinute,
    offerSelected: applyOffer,
    offerApplied: discountedMinutes > 0,
  };
};

export const buildTimeReceiptItems = (
  breakdown: TimeChargeBreakdown,
): Record<string, number> => {
  const items: Record<string, number> = {
    Time: breakdown.playedMinutes,
  };

  if (breakdown.offerApplied) {
    items['Billed Time'] = breakdown.billedMinutes;
    items['Offer Discount'] = breakdown.discountedMinutes;
  }

  return items;
};
