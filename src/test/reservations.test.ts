import { describe, expect, it } from 'vitest';

import { getDueReservationAlerts, type TableReservation } from '@/lib/reservations';

const buildReservation = (overrides: Partial<TableReservation> = {}): TableReservation => ({
  id: 'reservation-1',
  tableId: 1,
  tableName: 'Table 1',
  customerName: 'Test Customer',
  phone: '',
  startsAt: '2026-03-29T18:00:00.000Z',
  durationMinutes: 60,
  notes: '',
  createdAt: '2026-03-29T16:00:00.000Z',
  ...overrides,
});

describe('reservation alerts', () => {
  it('returns reservations that have started and are still in progress', () => {
    const due = buildReservation();
    const upcoming = buildReservation({
      id: 'reservation-2',
      startsAt: '2026-03-29T19:00:00.000Z',
    });
    const completed = buildReservation({
      id: 'reservation-3',
      startsAt: '2026-03-29T15:00:00.000Z',
    });

    expect(getDueReservationAlerts([due, upcoming, completed], [], Date.parse('2026-03-29T18:15:00.000Z'))).toEqual([due]);
  });

  it('skips reservations that were already alerted', () => {
    const due = buildReservation();

    expect(getDueReservationAlerts([due], ['reservation-1'], Date.parse('2026-03-29T18:15:00.000Z'))).toEqual([]);
  });
});
