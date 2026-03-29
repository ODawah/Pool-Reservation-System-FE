import { describe, expect, it } from 'vitest';

import { calculateBilledMinutes, calculateTimeCharge } from '@/lib/billing';

describe('billing offer', () => {
  it('does not discount anything unless the offer is selected', () => {
    expect(calculateBilledMinutes(120)).toBe(120);
    expect(calculateTimeCharge(120, 2)).toMatchObject({
      billedMinutes: 120,
      discountedMinutes: 0,
      timeCost: 240,
      offerApplied: false,
      offerSelected: false,
    });
  });

  it('keeps minutes unchanged before the offer threshold even when selected', () => {
    expect(calculateBilledMinutes(90, true)).toBe(90);
    expect(calculateTimeCharge(90, 2, true)).toMatchObject({
      billedMinutes: 90,
      discountedMinutes: 0,
      timeCost: 180,
      offerApplied: false,
      offerSelected: true,
    });
  });

  it('charges 2 played hours as 1.5 billed hours when the offer is selected', () => {
    expect(calculateBilledMinutes(120, true)).toBe(90);
    expect(calculateTimeCharge(120, 2, true)).toMatchObject({
      billedMinutes: 90,
      discountedMinutes: 30,
      timeCost: 180,
      offerApplied: true,
      offerSelected: true,
    });
  });

  it('applies the offer to each full 2-hour block and bills the remainder normally', () => {
    expect(calculateBilledMinutes(150, true)).toBe(120);
    expect(calculateBilledMinutes(240, true)).toBe(180);
    expect(calculateTimeCharge(240, 1.5, true)).toMatchObject({
      billedMinutes: 180,
      discountedMinutes: 60,
      timeCost: 270,
      offerApplied: true,
      offerSelected: true,
    });
  });
});
