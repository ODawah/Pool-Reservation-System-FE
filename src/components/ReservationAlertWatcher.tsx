import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  RESERVATIONS_STORAGE_KEY,
  getDueReservationAlerts,
  loadAlertedReservationIds,
  loadSavedReservations,
  saveAlertedReservationIds,
} from '@/lib/reservations';
import type { TableReservation } from '@/lib/reservations';

const ALERT_CHECK_INTERVAL_MS = 10000;

const formatTimeRange = (reservation: TableReservation) => {
  const start = new Date(reservation.startsAt);
  if (Number.isNaN(start.getTime())) return 'Invalid time';

  const end = new Date(start.getTime() + reservation.durationMinutes * 60000);
  return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const ReservationAlertWatcher = () => {
  const [pendingAlerts, setPendingAlerts] = useState<TableReservation[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncAlerts = () => {
      const reservations = loadSavedReservations();
      const reservationIds = new Set(reservations.map((reservation) => reservation.id));
      const storedAlertedIds = loadAlertedReservationIds();
      const prunedAlertedIds = storedAlertedIds.filter((reservationId) => reservationIds.has(reservationId));

      if (prunedAlertedIds.length !== storedAlertedIds.length) {
        saveAlertedReservationIds(prunedAlertedIds);
      }

      const dueReservations = getDueReservationAlerts(reservations, prunedAlertedIds);
      if (dueReservations.length === 0) return;

      saveAlertedReservationIds([
        ...prunedAlertedIds,
        ...dueReservations.map((reservation) => reservation.id),
      ]);

      setPendingAlerts((prev) => {
        const queuedIds = new Set(prev.map((reservation) => reservation.id));
        const nextAlerts = dueReservations.filter((reservation) => !queuedIds.has(reservation.id));
        return nextAlerts.length === 0 ? prev : [...prev, ...nextAlerts];
      });
    };

    syncAlerts();

    const intervalId = window.setInterval(syncAlerts, ALERT_CHECK_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncAlerts();
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === RESERVATIONS_STORAGE_KEY) {
        syncAlerts();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const activeAlert = pendingAlerts[0] ?? null;
  const dismissActiveAlert = () => {
    setPendingAlerts((prev) => prev.slice(1));
  };

  return (
    <Dialog open={Boolean(activeAlert)} onOpenChange={(open) => { if (!open) dismissActiveAlert(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reservation Time</DialogTitle>
          <DialogDescription>
            {activeAlert ? `${activeAlert.customerName} should be here now.` : 'Reservation reminder'}
          </DialogDescription>
        </DialogHeader>

        {activeAlert && (
          <div className="space-y-3 text-sm">
            <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
              Reservation time is now
            </Badge>
            <p><span className="text-muted-foreground">Table:</span> {activeAlert.tableName}</p>
            <p><span className="text-muted-foreground">Customer:</span> {activeAlert.customerName}</p>
            <p><span className="text-muted-foreground">Time:</span> {formatTimeRange(activeAlert)}</p>
            {activeAlert.phone && <p><span className="text-muted-foreground">Phone:</span> {activeAlert.phone}</p>}
            {activeAlert.notes && <p><span className="text-muted-foreground">Notes:</span> {activeAlert.notes}</p>}
            {pendingAlerts.length > 1 && (
              <p className="text-xs text-muted-foreground">
                {pendingAlerts.length - 1} more reservation reminder{pendingAlerts.length === 2 ? '' : 's'} waiting.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={dismissActiveAlert}>
            {pendingAlerts.length > 1 ? 'Next Reminder' : 'Dismiss'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReservationAlertWatcher;
