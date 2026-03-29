import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { loadSavedReservations, saveReservations } from '@/lib/reservations';
import { getTables } from '@/services/api';
import { logout } from '@/lib/auth';
import type { TableReservation } from '@/lib/reservations';
import type { TableInfo } from '@/types/pool-hall';
import { CalendarClock, CalendarDays, LayoutDashboard, LogOut, Trash2 } from 'lucide-react';

interface ReservationForm {
  tableId: string;
  customerName: string;
  phone: string;
  startsAt: string;
  durationMinutes: string;
  notes: string;
}

const MINUTES_PER_DAY = 24 * 60;
const PIXELS_PER_MINUTE = 1.5;
const TIMELINE_WIDTH = MINUTES_PER_DAY * PIXELS_PER_MINUTE;
const HOUR_MARKS = Array.from({ length: 25 }, (_, index) => index);

const getReservationStatus = (reservation: TableReservation) => {
  const now = Date.now();
  const start = new Date(reservation.startsAt).getTime();
  const end = start + reservation.durationMinutes * 60000;

  if (now < start) return 'Upcoming';
  if (now >= start && now < end) return 'In progress';
  return 'Completed';
};

const pad = (value: number) => String(value).padStart(2, '0');

const toDateKey = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const toLocalDateTimeValue = (value: Date) => {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
};

const getDefaultStartValue = () => {
  const nextHour = new Date();
  nextHour.setMinutes(nextHour.getMinutes() + 60);
  nextHour.setSeconds(0, 0);
  return toLocalDateTimeValue(nextHour);
};

const formatLongDate = (value: Date) =>
  value.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const formatTimeRange = (reservation: TableReservation) => {
  const start = new Date(reservation.startsAt);
  if (Number.isNaN(start.getTime())) return 'Invalid time';
  const end = new Date(start.getTime() + reservation.durationMinutes * 60000);
  return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const parseDateValue = (value: string): Date | null => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const getTimeValue = (value: string) => {
  const date = parseDateValue(value);
  if (!date) return '';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatStartDateTimeLabel = (value: string) => {
  const date = parseDateValue(value);
  if (!date) return 'Pick date and time';
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} • ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const minutesToDurationValue = (minutesValue: string) => {
  const totalMinutes = Number(minutesValue);
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return '01:00';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${pad(hours)}:${pad(minutes)}`;
};

const durationValueToMinutes = (value: string): number | null => {
  const [hoursStr, minutesStr] = value.split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return (hours * 60) + minutes;
};

const getTimelineSegment = (reservation: TableReservation) => {
  const start = new Date(reservation.startsAt);
  if (Number.isNaN(start.getTime())) return null;

  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = startMinutes + reservation.durationMinutes;
  const visibleStart = Math.max(0, startMinutes);
  const visibleEnd = Math.min(MINUTES_PER_DAY, endMinutes);
  const visibleDuration = visibleEnd - visibleStart;

  if (visibleDuration <= 0) return null;

  return {
    left: visibleStart * PIXELS_PER_MINUTE,
    width: Math.max(visibleDuration * PIXELS_PER_MINUTE, 12),
  };
};

const Reservations = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reservations, setReservations] = useState<TableReservation[]>(() => loadSavedReservations());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterTableId, setFilterTableId] = useState('all');
  const [focusedReservationId, setFocusedReservationId] = useState<string | null>(null);
  const [form, setForm] = useState<ReservationForm>({
    tableId: '',
    customerName: '',
    phone: '',
    startsAt: getDefaultStartValue(),
    durationMinutes: '60',
    notes: '',
  });

  useEffect(() => {
    saveReservations(reservations);
  }, [reservations]);

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

  const reservationCountByDay = useMemo(() => {
    const counts = new Map<string, number>();
    reservations.forEach((reservation) => {
      const key = toDateKey(reservation.startsAt);
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [reservations]);

  const calendarReservationDays = useMemo(() => {
    return Array.from(reservationCountByDay.keys()).map((key) => new Date(`${key}T12:00:00`));
  }, [reservationCountByDay]);

  const selectedDayReservations = useMemo(() => {
    const selectedKey = toDateKey(selectedDate);

    return reservations
      .filter((reservation) => {
        if (filterTableId !== 'all' && reservation.tableId !== Number(filterTableId)) return false;
        return toDateKey(reservation.startsAt) === selectedKey;
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [reservations, selectedDate, filterTableId]);

  const visibleTables = useMemo(() => {
    if (filterTableId === 'all') return tables;
    return tables.filter((table) => table.id === Number(filterTableId));
  }, [tables, filterTableId]);

  const reservationsByTable = useMemo(() => {
    const grouped = new Map<number, TableReservation[]>();
    selectedDayReservations.forEach((reservation) => {
      if (!grouped.has(reservation.tableId)) grouped.set(reservation.tableId, []);
      grouped.get(reservation.tableId)?.push(reservation);
    });
    grouped.forEach((entries) => entries.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
    return grouped;
  }, [selectedDayReservations]);

  const focusedReservation = useMemo(() => {
    if (!focusedReservationId) return null;
    return selectedDayReservations.find((reservation) => reservation.id === focusedReservationId) ?? null;
  }, [selectedDayReservations, focusedReservationId]);

  const isSelectedDateToday = toDateKey(selectedDate) === toDateKey(new Date());
  const now = new Date();
  const nowInMinutes = now.getHours() * 60 + now.getMinutes();

  useEffect(() => {
    if (!focusedReservationId) return;
    const stillVisible = selectedDayReservations.some((reservation) => reservation.id === focusedReservationId);
    if (!stillVisible) setFocusedReservationId(null);
  }, [selectedDayReservations, focusedReservationId]);

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

  const handleCalendarSelect = (day?: Date) => {
    if (!day) return;
    setSelectedDate(day);

    setForm((prev) => {
      const existing = prev.startsAt ? new Date(prev.startsAt) : new Date();
      const safeHours = Number.isNaN(existing.getTime()) ? 12 : existing.getHours();
      const safeMinutes = Number.isNaN(existing.getTime()) ? 0 : existing.getMinutes();
      const nextDateTime = new Date(day);
      nextDateTime.setHours(safeHours, safeMinutes, 0, 0);
      return { ...prev, startsAt: toLocalDateTimeValue(nextDateTime) };
    });
  };

  const handleFormDateSelect = (day?: Date) => {
    if (!day) return;

    setForm((prev) => {
      const current = parseDateValue(prev.startsAt);
      const merged = new Date(day);
      merged.setHours(current?.getHours() ?? 12, current?.getMinutes() ?? 0, 0, 0);
      return { ...prev, startsAt: toLocalDateTimeValue(merged) };
    });
  };

  const handleFormTimeChange = (value: string) => {
    const [hoursStr, minutesStr] = value.split(':');
    const hours = Number(hoursStr);
    const minutes = Number(minutesStr);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return;

    setForm((prev) => {
      const base = parseDateValue(prev.startsAt) ?? new Date();
      const next = new Date(base);
      next.setHours(hours, minutes, 0, 0);
      return { ...prev, startsAt: toLocalDateTimeValue(next) };
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

    setReservations((prev) => [...prev, newReservation]);
    setSelectedDate(new Date(newReservation.startsAt));

    const nextSuggested = new Date(startsAtMs + durationMinutes * 60000);
    setForm({
      tableId: '',
      customerName: '',
      phone: '',
      startsAt: toLocalDateTimeValue(nextSuggested),
      durationMinutes: '60',
      notes: '',
    });

    setSaving(false);
    toast({ title: 'Reservation added', description: `${table.name} reserved for ${newReservation.customerName}.` });
  };

  const handleDeleteReservation = (reservationId: string) => {
    setReservations((prev) => prev.filter((reservation) => reservation.id !== reservationId));
    setFocusedReservationId((prev) => (prev === reservationId ? null : prev));
    toast({ title: 'Reservation removed' });
  };

  const clearTableFilter = () => {
    setFilterTableId('all');
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

      <main className="p-6">
        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <div className="flex flex-col gap-6">
            <Card className="order-2">
              <CardContent className="p-4">
                <div className="rounded-md border">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleCalendarSelect}
                    className="mx-auto"
                    modifiers={{ hasReservations: calendarReservationDays }}
                    modifiersClassNames={{
                      hasReservations: 'bg-primary/15 text-primary font-semibold',
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="order-1">
              <CardHeader>
                <CardTitle>Create Reservation</CardTitle>
                <CardDescription>Use date-time and duration to place a reservation into the calendar.</CardDescription>
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
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarDays className="h-4 w-4" />
                          <span className="truncate">{formatStartDateTimeLabel(form.startsAt)}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto p-0">
                        <div className="border-b p-2">
                          <Calendar
                            mode="single"
                            selected={parseDateValue(form.startsAt) ?? undefined}
                            onSelect={handleFormDateSelect}
                            initialFocus
                          />
                        </div>
                        <div className="p-3 pt-2">
                          <Label htmlFor="start-time-field">Time</Label>
                          <Input
                            id="start-time-field"
                            type="time"
                            step={60}
                            value={getTimeValue(form.startsAt)}
                            onChange={(event) => handleFormTimeChange(event.target.value)}
                            className="mt-2"
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Duration (minutes)</Label>
                    <Input
                      type="time"
                      step={300}
                      value={minutesToDurationValue(form.durationMinutes)}
                      onChange={(event) => {
                        const nextMinutes = durationValueToMinutes(event.target.value);
                        if (nextMinutes === null) return;
                        setForm((prev) => ({ ...prev, durationMinutes: String(nextMinutes) }));
                      }}
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
          </div>

          <Card className="xl:flex xl:min-h-0 xl:flex-col">
            <CardHeader>
              <CardTitle>Table Timetable</CardTitle>
              <CardDescription>
                One line per table for {formatLongDate(selectedDate)}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 xl:grid xl:min-h-0 xl:flex-1 xl:grid-rows-[auto_minmax(0,1fr)_auto] xl:gap-4 xl:space-y-0 xl:overflow-hidden">
              <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                <div className="space-y-2">
                  <Label>Filter by table</Label>
                  <Select value={filterTableId} onValueChange={setFilterTableId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All tables" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All tables</SelectItem>
                      {tables.map((table) => (
                        <SelectItem key={`timetable-filter-table-${table.id}`} value={String(table.id)}>
                          {table.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <p className="font-semibold">{formatLongDate(selectedDate)}</p>
                  <p className="text-muted-foreground">
                    Showing {selectedDayReservations.length} reservation{selectedDayReservations.length === 1 ? '' : 's'}
                    {filterTableId !== 'all' ? ' in selected table' : ''}.
                  </p>
                  {filterTableId !== 'all' && (
                    <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={clearTableFilter}>
                      Clear table filter
                    </Button>
                  )}
                </div>
              </div>

              {visibleTables.length === 0 ? (
                <p className="text-muted-foreground">No tables found.</p>
              ) : (
                <div className="min-h-0 overflow-auto rounded-md border">
                  <div className="min-w-max">
                    <div className="flex border-b bg-muted/50">
                      <div className="w-36 shrink-0 border-r px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Table
                      </div>
                      <div className="relative h-10" style={{ width: `${TIMELINE_WIDTH}px` }}>
                        {HOUR_MARKS.map((hour) => (
                          <div
                            key={`hour-head-${hour}`}
                            className="absolute inset-y-0 border-l border-border/40"
                            style={{ left: `${hour * 60 * PIXELS_PER_MINUTE}px` }}
                          >
                            <span className="absolute left-0 top-1 -translate-x-1/2 text-[10px] text-muted-foreground">
                              {pad(hour)}:00
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {visibleTables.map((table) => {
                      const tableReservations = reservationsByTable.get(table.id) ?? [];

                      return (
                        <div key={`timeline-table-${table.id}`} className="flex border-b last:border-b-0">
                          <div className="w-36 shrink-0 border-r px-3 py-3">
                            <p className="text-sm font-semibold">{table.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {tableReservations.length} reservation{tableReservations.length === 1 ? '' : 's'}
                            </p>
                          </div>

                          <div className="relative h-20" style={{ width: `${TIMELINE_WIDTH}px` }}>
                            {HOUR_MARKS.map((hour) => (
                              <div
                                key={`hour-grid-${table.id}-${hour}`}
                                className="absolute inset-y-0 border-l border-border/20"
                                style={{ left: `${hour * 60 * PIXELS_PER_MINUTE}px` }}
                              />
                            ))}

                            {isSelectedDateToday && (
                              <div
                                className="absolute inset-y-0 z-20 border-l-2 border-red-500"
                                style={{ left: `${nowInMinutes * PIXELS_PER_MINUTE}px` }}
                              />
                            )}

                            {tableReservations.map((reservation) => {
                              const segment = getTimelineSegment(reservation);
                              if (!segment) return null;

                              const status = getReservationStatus(reservation);
                              const colorClass =
                                status === 'Upcoming'
                                  ? 'bg-primary/90 hover:bg-primary text-primary-foreground'
                                  : status === 'In progress'
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-muted-foreground/80 hover:bg-muted-foreground text-white';

                              return (
                                <button
                                  key={reservation.id}
                                  type="button"
                                  className={`absolute top-4 h-12 rounded-md px-2 text-left text-xs font-medium shadow-sm transition-colors ${colorClass} ${
                                    focusedReservationId === reservation.id ? 'ring-2 ring-offset-1 ring-primary' : ''
                                  }`}
                                  style={{ left: `${segment.left}px`, width: `${segment.width}px` }}
                                  title={`${reservation.tableName} • ${reservation.customerName} • ${formatTimeRange(reservation)}`}
                                  onClick={() => setFocusedReservationId(reservation.id)}
                                >
                                  <div className="truncate">{reservation.customerName}</div>
                                  <div className="truncate opacity-90">{formatTimeRange(reservation)}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {focusedReservation ? (
                <div className="max-h-44 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{focusedReservation.tableName}</p>
                      <p className="text-muted-foreground">{focusedReservation.customerName}</p>
                    </div>
                    <Badge
                      variant={
                        getReservationStatus(focusedReservation) === 'Upcoming'
                          ? 'default'
                          : getReservationStatus(focusedReservation) === 'In progress'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {getReservationStatus(focusedReservation)}
                    </Badge>
                  </div>
                  <p><span className="text-muted-foreground">Time:</span> {formatTimeRange(focusedReservation)}</p>
                  <p><span className="text-muted-foreground">Duration:</span> {focusedReservation.durationMinutes} minutes</p>
                  {focusedReservation.phone && <p><span className="text-muted-foreground">Phone:</span> {focusedReservation.phone}</p>}
                  {focusedReservation.notes && <p><span className="text-muted-foreground">Notes:</span> {focusedReservation.notes}</p>}
                  <div className="mt-3">
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteReservation(focusedReservation.id)}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ) : selectedDayReservations.length > 0 ? (
                <p className="text-sm text-muted-foreground">Click a reservation block to view details.</p>
              ) : (
                <p className="text-sm text-muted-foreground">No reservations for this day.</p>
              )}
            </CardContent>
          </Card>
        </div>

      </main>
    </div>
  );
};

export default Reservations;
