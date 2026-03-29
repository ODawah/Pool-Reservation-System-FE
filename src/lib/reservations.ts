export interface TableReservation {
  id: string;
  tableId: number;
  tableName: string;
  customerName: string;
  phone: string;
  startsAt: string;
  durationMinutes: number;
  notes: string;
  createdAt: string;
}

export const RESERVATIONS_STORAGE_KEY = 'table-reservations-v1';
export const RESERVATION_ALERTS_STORAGE_KEY = 'table-reservation-alerts-v1';

export const loadSavedReservations = (): TableReservation[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(RESERVATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TableReservation[]) : [];
  } catch {
    return [];
  }
};

export const saveReservations = (reservations: TableReservation[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(RESERVATIONS_STORAGE_KEY, JSON.stringify(reservations));
};

export const loadAlertedReservationIds = (): string[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(RESERVATION_ALERTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
};

export const saveAlertedReservationIds = (reservationIds: string[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(RESERVATION_ALERTS_STORAGE_KEY, JSON.stringify(reservationIds));
};

export const getDueReservationAlerts = (
  reservations: TableReservation[],
  alertedReservationIds: string[],
  now = Date.now(),
) => {
  const alertedSet = new Set(alertedReservationIds);

  return reservations
    .filter((reservation) => {
      const start = new Date(reservation.startsAt).getTime();
      if (Number.isNaN(start)) return false;

      const end = start + (reservation.durationMinutes * 60000);
      return now >= start && now < end && !alertedSet.has(reservation.id);
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
};
