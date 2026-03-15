import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getTables } from '@/services/api';
import { logout } from '@/lib/auth';
import type { TableInfo } from '@/types/pool-hall';
import { CalendarClock, LayoutDashboard, LogOut, Trash2 } from 'lucide-react';

interface TableReservation {
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

interface ReservationForm {
  tableId: string;
  customerName: string;
  phone: string;
  startsAt: string;
  durationMinutes: string;
  notes: string;
}

const STORAGE_KEY = 'table-reservations-v1';

const getReservationStatus = (reservation: TableReservation) => {
  const now = Date.now();
  const start = new Date(reservation.startsAt).getTime();
  const end = start + reservation.durationMinutes * 60000;

  if (now < start) return 'Upcoming';
  if (now >= start && now < end) return 'In progress';
  return 'Completed';
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const loadSavedReservations = (): TableReservation[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TableReservation[]) : [];
  } catch {
    return [];
  }
};

const saveReservations = (reservations: TableReservation[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
};

const Reservations = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reservations, setReservations] = useState<TableReservation[]>([]);
  const [filterTableId, setFilterTableId] = useState('all');
  const [filterFromTime, setFilterFromTime] = useState('');
  const [filterToTime, setFilterToTime] = useState('');
  const [form, setForm] = useState<ReservationForm>({
    tableId: '',
    customerName: '',
    phone: '',
    startsAt: '',
    durationMinutes: '60',
    notes: '',
  });

  useEffect(() => {
    setReservations(loadSavedReservations());
  }, []);

  useEffect(() => {
    const loadTables = async () => {
      try {
        const data = await getTables();
        setTables(data);
      } catch {
        toast({ title: 'Failed to load tables', variant: 'destructive' });
      } finally {
        setLoadingTables(false);
      }
    };

    loadTables();
  }, [toast]);

  const filteredReservations = useMemo(() => {
    const parsedFromTime = filterFromTime ? new Date(filterFromTime).getTime() : null;
    const parsedToTime = filterToTime ? new Date(filterToTime).getTime() : null;

    const fromTime = parsedFromTime !== null && !Number.isNaN(parsedFromTime) ? parsedFromTime : null;
    const toTime = parsedToTime !== null && !Number.isNaN(parsedToTime) ? parsedToTime : null;

    const minTime = fromTime !== null && toTime !== null ? Math.min(fromTime, toTime) : fromTime;
    const maxTime = fromTime !== null && toTime !== null ? Math.max(fromTime, toTime) : toTime;

    return reservations
      .filter((reservation) => {
        if (filterTableId !== 'all' && reservation.tableId !== Number(filterTableId)) {
          return false;
        }

        const reservationStart = new Date(reservation.startsAt).getTime();
        if (Number.isNaN(reservationStart)) return false;

        if (minTime !== null && reservationStart < minTime) return false;
        if (maxTime !== null && reservationStart > maxTime) return false;

        return true;
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [reservations, filterTableId, filterFromTime, filterToTime]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const hasConflict = (tableId: number, startsAt: number, durationMinutes: number) => {
    const end = startsAt + durationMinutes * 60000;

    return reservations.some((reservation) => {
      if (reservation.tableId !== tableId) return false;
      const existingStart = new Date(reservation.startsAt).getTime();
      const existingEnd = existingStart + reservation.durationMinutes * 60000;
      return startsAt < existingEnd && end > existingStart;
    });
  };

  const handleCreateReservation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const tableId = Number(form.tableId);
    const durationMinutes = Number(form.durationMinutes);
    const startsAtMs = new Date(form.startsAt).getTime();

    if (!tableId || !form.customerName || !form.startsAt || !durationMinutes) {
      toast({ title: 'Missing fields', description: 'Fill table, customer, start time, and duration.', variant: 'destructive' });
      return;
    }

    if (Number.isNaN(startsAtMs)) {
      toast({ title: 'Invalid date', description: 'Please select a valid reservation date and time.', variant: 'destructive' });
      return;
    }

    if (startsAtMs < Date.now()) {
      toast({ title: 'Invalid time', description: 'Reservation start time must be in the future.', variant: 'destructive' });
      return;
    }

    if (durationMinutes <= 0) {
      toast({ title: 'Invalid duration', description: 'Duration must be greater than 0 minutes.', variant: 'destructive' });
      return;
    }

    const table = tables.find((item) => item.id === tableId);
    if (!table) {
      toast({ title: 'Invalid table', description: 'Please select a valid table.', variant: 'destructive' });
      return;
    }

    if (hasConflict(tableId, startsAtMs, durationMinutes)) {
      toast({ title: 'Time conflict', description: 'This table already has a reservation in that time range.', variant: 'destructive' });
      return;
    }

    setSaving(true);

    const newReservation: TableReservation = {
      id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      tableId,
      tableName: table.name,
      customerName: form.customerName.trim(),
      phone: form.phone.trim(),
      startsAt: new Date(form.startsAt).toISOString(),
      durationMinutes,
      notes: form.notes.trim(),
      createdAt: new Date().toISOString(),
    };

    setReservations((prev) => {
      const next = [...prev, newReservation];
      saveReservations(next);
      return next;
    });

    setForm({
      tableId: '',
      customerName: '',
      phone: '',
      startsAt: '',
      durationMinutes: '60',
      notes: '',
    });

    setSaving(false);
    toast({ title: 'Reservation added', description: `${table.name} reserved for ${newReservation.customerName}.` });
  };

  const handleDeleteReservation = (reservationId: string) => {
    setReservations((prev) => {
      const next = prev.filter((reservation) => reservation.id !== reservationId);
      saveReservations(next);
      return next;
    });
    toast({ title: 'Reservation removed' });
  };

  const clearFilters = () => {
    setFilterTableId('all');
    setFilterFromTime('');
    setFilterToTime('');
  };

  return (
    <div className="min-h-screen bg-background felt-texture">
      <header className="border-b border-border/50 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">Table Reservations</h1>
              <p className="text-xs text-muted-foreground tracking-widest uppercase">The Lounge</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Create Reservation</CardTitle>
            <CardDescription>Reserve a table by customer and time slot.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateReservation}>
              <div className="space-y-2">
                <Label>Table</Label>
                <Select value={form.tableId} onValueChange={(value) => setForm((prev) => ({ ...prev, tableId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingTables ? 'Loading tables...' : 'Select table'} />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((table) => (
                      <SelectItem key={table.id} value={String(table.id)}>
                        {table.name} (${table.price}/min)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input
                  value={form.customerName}
                  onChange={(event) => setForm((prev) => ({ ...prev, customerName: event.target.value }))}
                  placeholder="Enter customer name"
                />
              </div>

              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, startsAt: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  min={10}
                  step={10}
                  value={form.durationMinutes}
                  onChange={(event) => setForm((prev) => ({ ...prev, durationMinutes: event.target.value }))}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Optional notes"
                />
              </div>

              <div className="md:col-span-2">
                <Button type="submit" disabled={saving || loadingTables || tables.length === 0}>
                  {saving ? 'Saving...' : 'Reserve Table'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reservations List</CardTitle>
            <CardDescription>Upcoming, active, and completed reservations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Filter by table</Label>
                <Select value={filterTableId} onValueChange={setFilterTableId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All tables" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tables</SelectItem>
                    {tables.map((table) => (
                      <SelectItem key={`filter-table-${table.id}`} value={String(table.id)}>
                        {table.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>From time</Label>
                <Input
                  type="datetime-local"
                  value={filterFromTime}
                  onChange={(event) => setFilterFromTime(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>To time</Label>
                <Input
                  type="datetime-local"
                  value={filterToTime}
                  onChange={(event) => setFilterToTime(event.target.value)}
                />
              </div>

              <div className="flex items-end">
                <Button type="button" variant="outline" className="w-full" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Showing {filteredReservations.length} of {reservations.length} reservations
            </p>

            {reservations.length === 0 ? (
              <p className="text-muted-foreground">No reservations yet.</p>
            ) : filteredReservations.length === 0 ? (
              <p className="text-muted-foreground">No reservations match these filters.</p>
            ) : (
              filteredReservations.map((reservation) => {
                const status = getReservationStatus(reservation);
                const badgeVariant =
                  status === 'Upcoming' ? 'default' : status === 'In progress' ? 'secondary' : 'outline';

                return (
                  <div key={reservation.id} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{reservation.tableName}</p>
                        <p className="text-sm text-muted-foreground">{reservation.customerName}</p>
                      </div>
                      <Badge variant={badgeVariant}>{status}</Badge>
                    </div>

                    <div className="text-sm space-y-1">
                      <p><span className="text-muted-foreground">Starts:</span> {formatDateTime(reservation.startsAt)}</p>
                      <p><span className="text-muted-foreground">Duration:</span> {reservation.durationMinutes} minutes</p>
                      {reservation.phone && <p><span className="text-muted-foreground">Phone:</span> {reservation.phone}</p>}
                      {reservation.notes && <p><span className="text-muted-foreground">Notes:</span> {reservation.notes}</p>}
                    </div>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteReservation(reservation.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Reservations;
