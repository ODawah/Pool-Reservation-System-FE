import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TableCard from '@/components/TableCard';
import EmployeesTab from '@/components/tabs/EmployeesTab';
import AttendanceTab from '@/components/tabs/AttendanceTab';
import RevenueTab from '@/components/tabs/RevenueTab';
import ExpensesTab from '@/components/tabs/ExpensesTab';
import { getShopItems, getTables, createReceipt } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { logout } from '@/lib/auth';
import { buildTimeReceiptItems, calculateTimeCharge, TABLE_TIME_OFFER } from '@/lib/billing';
import type { TableSession, ShopItem, ReceiptPayload, TableInfo } from '@/types/pool-hall';
import { CalendarClock, LogOut } from 'lucide-react';

type PaymentMethod = 'Cash' | 'Visa';

interface DraftReceipt {
  tableId: number;
  tableLabel: string;
  offerEnabled: boolean;
  totalMinutes: number;
  billedMinutes: number;
  discountedMinutes: number;
  timeCost: number;
  ordersCost: number;
  carryOverCost: number;
  totalPrice: number;
  items: Record<string, number>;
}

interface SavedTableSession {
  id: number;
  isActive: boolean;
  offerEnabled: boolean;
  startTime: number | null;
  orders: TableSession['orders'];
  carryOverCost: number;
  carryOverItems: Record<string, number>;
}

const TABLE_SESSIONS_STORAGE_KEY = 'table-sessions-v1';

const typeFromName = (name: string): 'pool' | 'carrom' | 'ps' => {
  const lower = name.toLowerCase();
  if (lower.includes('carrom')) return 'carrom';
  if (lower.includes('ps')) return 'ps';
  return 'pool';
};

const mergeReceiptItems = (
  base: Record<string, number>,
  incoming: Record<string, number>,
): Record<string, number> => {
  const merged: Record<string, number> = { ...base };
  Object.entries(incoming).forEach(([key, value]) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;
    merged[key] = (merged[key] || 0) + numericValue;
  });
  return merged;
};

const loadSavedTableSessions = (): SavedTableSession[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(TABLE_SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is SavedTableSession => (
        typeof item?.id === 'number'
      ))
      .map((item) => ({
        carryOverItems: Object.entries(
          typeof item?.carryOverItems === 'object' && item.carryOverItems !== null
            ? (item.carryOverItems as Record<string, unknown>)
            : {},
        ).reduce<Record<string, number>>((acc, [key, value]) => {
          const numericValue = Number(value);
          if (Number.isFinite(numericValue)) {
            acc[key] = numericValue;
          }
          return acc;
        }, {}),
        carryOverCost: Number.isFinite(Number(item?.carryOverCost))
          ? Number(item.carryOverCost)
          : 0,
        id: item.id,
        isActive: Boolean(item.isActive),
        offerEnabled: Boolean(item?.offerEnabled),
        startTime: typeof item.startTime === 'number' ? item.startTime : null,
        orders: Array.isArray(item.orders) ? item.orders : [],
      }));
  } catch {
    return [];
  }
};

const saveTableSessions = (tables: TableSession[]) => {
  if (typeof window === 'undefined') return;

  const payload: SavedTableSession[] = tables.map((table) => ({
    id: table.id,
    isActive: table.isActive,
    offerEnabled: table.offerEnabled,
    startTime: table.startTime,
    orders: table.orders,
    carryOverCost: table.carryOverCost,
    carryOverItems: table.carryOverItems,
  }));

  window.localStorage.setItem(TABLE_SESSIONS_STORAGE_KEY, JSON.stringify(payload));
};

const Index = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tables, setTables] = useState<TableSession[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [receiptDraft, setReceiptDraft] = useState<DraftReceipt | null>(null);
  const [receiptTargetTableId, setReceiptTargetTableId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [submittingReceipt, setSubmittingReceipt] = useState(false);
  const [switchSourceTableId, setSwitchSourceTableId] = useState<number | null>(null);
  const [switchTargetTableId, setSwitchTargetTableId] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [tableData, items] = await Promise.all([getTables(), getShopItems()]);
      const savedById = new Map(loadSavedTableSessions().map((session) => [session.id, session]));
      setShopItems(items);
      setTables(prev => {
        // Merge API table info with existing session state
        return tableData.map((t: TableInfo) => {
          const existing = prev.find(p => p.id === t.id);
          const saved = savedById.get(t.id);
          const current = existing ?? saved;
          return {
            id: t.id,
            label: t.name,
            type: typeFromName(t.name),
            isActive: current?.isActive ?? false,
            offerEnabled: current?.offerEnabled ?? false,
            startTime: current?.startTime ?? null,
            orders: current?.orders ?? [],
            pricePerMinute: t.price,
            carryOverCost: current?.carryOverCost ?? 0,
            carryOverItems: current?.carryOverItems ?? {},
          };
        });
      });
    } catch {
      console.error('Failed to fetch data');
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (tables.length === 0) return;
    saveTableSessions(tables);
  }, [tables]);

  const handleStart = (id: number) => {
    setTables(prev => prev.map(t => t.id === id ? { ...t, isActive: true, offerEnabled: false, startTime: Date.now() } : t));
  };

  const handleToggleOffer = (id: number, enabled: boolean) => {
    setTables((prev) => prev.map((table) => (
      table.id === id ? { ...table, offerEnabled: enabled } : table
    )));
  };

  const handleStop = (id: number) => {
    const table = tables.find(t => t.id === id);
    if (!table || !table.startTime) return;

    const totalMinutes = Math.round((Date.now() - table.startTime) / 60000);
    const timeBreakdown = calculateTimeCharge(totalMinutes, table.pricePerMinute, table.offerEnabled);
    const timeCost = timeBreakdown.timeCost;
    const ordersCost = table.orders.reduce((s, o) => s + o.shopItem.price * o.quantity, 0);

    // Build current segment items as { name: qty } dict.
    const currentItems: Record<string, number> = {};
    table.orders.forEach(o => {
      currentItems[o.shopItem.name] = (currentItems[o.shopItem.name] || 0) + o.quantity;
    });
    Object.assign(currentItems, buildTimeReceiptItems(timeBreakdown));
    const carryOverCost = table.carryOverCost || 0;
    const items = mergeReceiptItems(table.carryOverItems || {}, currentItems);

    setPaymentMethod('Cash');
    setReceiptTargetTableId(String(table.id));
    setReceiptDraft({
      tableId: table.id,
      tableLabel: table.label,
      offerEnabled: table.offerEnabled,
      totalMinutes,
      billedMinutes: timeBreakdown.billedMinutes,
      discountedMinutes: timeBreakdown.discountedMinutes,
      timeCost,
      ordersCost,
      carryOverCost,
      totalPrice: carryOverCost + timeCost + ordersCost,
      items,
    });
  };

  const closeDraft = () => {
    if (submittingReceipt) return;
    setReceiptDraft(null);
    setReceiptTargetTableId('');
  };

  const handleDone = async () => {
    if (!receiptDraft) return;
    const targetTableId = Number(receiptTargetTableId || receiptDraft.tableId);
    const targetTable = tables.find((table) => table.id === targetTableId);
    const sourceTable = tables.find((table) => table.id === receiptDraft.tableId);

    if (!targetTable) {
      toast({ title: 'Choose a valid table for this receipt', variant: 'destructive' });
      return;
    }
    if (!sourceTable) {
      toast({ title: 'Source table is not available', variant: 'destructive' });
      return;
    }
    if (targetTableId !== receiptDraft.tableId && targetTable.isActive) {
      toast({ title: 'Target table must be idle', variant: 'destructive' });
      return;
    }

    if (targetTableId !== receiptDraft.tableId) {
      setTables((prev) =>
        prev.map((table) => {
          if (table.id === receiptDraft.tableId) {
            return {
              ...table,
              isActive: false,
              offerEnabled: false,
              startTime: null,
              orders: [],
              carryOverCost: 0,
              carryOverItems: {},
            };
          }

          if (table.id === targetTableId) {
            return {
              ...table,
              isActive: true,
              offerEnabled: receiptDraft.offerEnabled,
              startTime: table.startTime ?? Date.now(),
              carryOverCost: (table.carryOverCost || 0) + receiptDraft.totalPrice,
              carryOverItems: mergeReceiptItems(table.carryOverItems || {}, receiptDraft.items),
            };
          }

          return table;
        }),
      );
      toast({
        title: 'Charges moved to another table',
        description: `${sourceTable.label} charges added to ${targetTable.label}. Finish and bill from ${targetTable.label}.`,
      });
      setReceiptDraft(null);
      setReceiptTargetTableId('');
      return;
    }

    const receipt: ReceiptPayload = {
      table_id: targetTableId,
      items: receiptDraft.items,
      total_price: receiptDraft.totalPrice,
      payment_type: paymentMethod,
      timestamp: new Date().toISOString(),
    };

    try {
      setSubmittingReceipt(true);
      await createReceipt(receipt);
      toast({
        title: 'Receipt created',
        description: `${receiptDraft.tableLabel} -> ${targetTable.label} — ${paymentMethod} — $${receipt.total_price.toFixed(2)}`,
      });
      setTables(prev => prev.map(t => (
        t.id === receiptDraft.tableId
          ? { ...t, isActive: false, offerEnabled: false, startTime: null, orders: [], carryOverCost: 0, carryOverItems: {} }
          : t
      )));
      setReceiptDraft(null);
      setReceiptTargetTableId('');
      fetchData();
    } catch {
      toast({ title: 'Failed to create receipt', variant: 'destructive' });
    } finally {
      setSubmittingReceipt(false);
    }
  };

  const handleAddItem = (tableId: number, item: ShopItem) => {
    setTables(prev => prev.map(t => {
      if (t.id !== tableId) return t;
      const existing = t.orders.findIndex(o => o.shopItem.name === item.name);
      const newOrders = [...t.orders];
      if (existing >= 0) {
        newOrders[existing] = { ...newOrders[existing], quantity: newOrders[existing].quantity + 1 };
      } else {
        newOrders.push({ shopItem: item, quantity: 1 });
      }
      return { ...t, orders: newOrders };
    }));
  };

  const handleRemoveItem = (tableId: number, itemIndex: number) => {
    setTables(prev => prev.map(t => {
      if (t.id !== tableId) return t;
      const newOrders = [...t.orders];
      if (newOrders[itemIndex].quantity > 1) {
        newOrders[itemIndex] = { ...newOrders[itemIndex], quantity: newOrders[itemIndex].quantity - 1 };
      } else {
        newOrders.splice(itemIndex, 1);
      }
      return { ...t, orders: newOrders };
    }));
  };

  const availableSwitchTargets = tables.filter((table) => (
    switchSourceTableId !== null && table.id !== switchSourceTableId && !table.isActive
  ));

  const switchSourceTable = switchSourceTableId === null
    ? null
    : tables.find((table) => table.id === switchSourceTableId) ?? null;

  const closeSwitchDialog = () => {
    setSwitchSourceTableId(null);
    setSwitchTargetTableId('');
  };

  const handleOpenSwitch = (sourceTableId: number) => {
    const sourceTable = tables.find((table) => table.id === sourceTableId);
    if (!sourceTable?.isActive) {
      toast({ title: 'Only active tables can be switched', variant: 'destructive' });
      return;
    }

    const targets = tables.filter((table) => table.id !== sourceTableId && !table.isActive);
    if (targets.length === 0) {
      toast({ title: 'No available tables to switch into', variant: 'destructive' });
      return;
    }

    setSwitchSourceTableId(sourceTableId);
    setSwitchTargetTableId(String(targets[0].id));
  };

  const handleConfirmSwitch = () => {
    if (switchSourceTableId === null || !switchTargetTableId) return;
    const targetTableId = Number(switchTargetTableId);

    if (!targetTableId) {
      toast({ title: 'Choose a target table', variant: 'destructive' });
      return;
    }

    let didSwitch = false;
    let sourceLabel = '';
    let targetLabel = '';

    setTables((prev) => {
      const source = prev.find((table) => table.id === switchSourceTableId);
      const target = prev.find((table) => table.id === targetTableId);

      if (!source || !target || !source.isActive || target.isActive) {
        return prev;
      }

      didSwitch = true;
      sourceLabel = source.label;
      targetLabel = target.label;
      const movedOrders = source.orders.map((order) => ({ ...order }));

      return prev.map((table) => {
        if (table.id === source.id) {
          return { ...table, isActive: false, offerEnabled: false, startTime: null, orders: [], carryOverCost: 0, carryOverItems: {} };
        }
        if (table.id === target.id) {
          return {
            ...table,
            isActive: true,
            offerEnabled: source.offerEnabled,
            startTime: source.startTime,
            orders: movedOrders,
            carryOverCost: (target.carryOverCost || 0) + (source.carryOverCost || 0),
            carryOverItems: mergeReceiptItems(target.carryOverItems || {}, source.carryOverItems || {}),
          };
        }
        return table;
      });
    });

    if (!didSwitch) {
      toast({ title: 'Unable to switch table', variant: 'destructive' });
      return;
    }

    toast({
      title: 'Table switched',
      description: `${sourceLabel} moved to ${targetLabel} with elapsed time preserved.`,
    });
    closeSwitchDialog();
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background felt-texture">
      <header className="border-b border-border/50 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎱</span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">The Lounge</h1>
              <p className="text-xs text-muted-foreground tracking-widest uppercase">Pool Hall Manager</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/reservations">
                <CalendarClock className="h-4 w-4" />
                Reservations
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
        <Tabs defaultValue="tables">
          <TabsList className="mb-6 bg-muted/50 border border-border/50">
            <TabsTrigger value="tables" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">🎱 Tables</TabsTrigger>
            <TabsTrigger value="employees" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">👥 Employees</TabsTrigger>
            <TabsTrigger value="attendance" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">⏰ Attendance</TabsTrigger>
            <TabsTrigger value="revenue" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">💰 Revenue</TabsTrigger>
            <TabsTrigger value="expenses" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">📝 Expenses</TabsTrigger>
          </TabsList>

          <TabsContent value="tables">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tables.map(t => (
                <TableCard
                  key={t.id}
                  session={t}
                  shopItems={shopItems}
                  onStart={handleStart}
                  onStop={handleStop}
                  onToggleOffer={handleToggleOffer}
                  onSwitchTable={handleOpenSwitch}
                  onAddItem={handleAddItem}
                  onRemoveItem={handleRemoveItem}
                />
              ))}
              {tables.length === 0 && (
                <p className="col-span-full text-center text-muted-foreground py-8">Loading tables...</p>
              )}
            </div>
          </TabsContent>
          <TabsContent value="employees"><EmployeesTab /></TabsContent>
          <TabsContent value="attendance"><AttendanceTab /></TabsContent>
          <TabsContent value="revenue"><RevenueTab /></TabsContent>
          <TabsContent value="expenses"><ExpensesTab /></TabsContent>
        </Tabs>

        <Dialog open={switchSourceTableId !== null} onOpenChange={(open) => { if (!open) closeSwitchDialog(); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {switchSourceTable ? `Switch ${switchSourceTable.label}` : 'Switch table'}
              </DialogTitle>
              <DialogDescription>
                Move this active session to another idle table while keeping the same start time.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <p className="text-sm font-medium">Target table</p>
              <Select value={switchTargetTableId} onValueChange={setSwitchTargetTableId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select table" />
                </SelectTrigger>
                <SelectContent>
                  {availableSwitchTargets.map((table) => (
                    <SelectItem key={`switch-target-${table.id}`} value={String(table.id)}>
                      {table.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeSwitchDialog}>
                Cancel
              </Button>
              <Button onClick={handleConfirmSwitch} disabled={!switchTargetTableId}>
                Switch
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(receiptDraft)} onOpenChange={(open) => { if (!open) closeDraft(); }}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {receiptDraft ? `Receipt - ${receiptDraft.tableLabel}` : 'Receipt'}
              </DialogTitle>
              <DialogDescription>{new Date().toLocaleString()}</DialogDescription>
            </DialogHeader>

            {receiptDraft && (
              <div className="space-y-4">
                {receiptDraft.offerEnabled && (
                  <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                    {receiptDraft.discountedMinutes > 0 ? 'Offer applied' : 'Offer selected'}
                  </Badge>
                )}

                <div className="space-y-1">
                  {Object.entries(receiptDraft.items).map(([name, quantity]) => (
                    <div key={name} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{name}</span>
                      <span className="font-medium">{quantity}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 rounded-md border p-3 text-sm">
                  {receiptDraft.carryOverCost > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Carried from previous table</span>
                      <span>${receiptDraft.carryOverCost.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Played time</span>
                    <span>{receiptDraft.totalMinutes} min</span>
                  </div>
                  {receiptDraft.discountedMinutes > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Billed time after offer</span>
                      <span>{receiptDraft.billedMinutes} min</span>
                    </div>
                  )}
                  {receiptDraft.discountedMinutes > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Offer discount</span>
                      <span>-{receiptDraft.discountedMinutes} min</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Table time cost</span>
                    <span>${receiptDraft.timeCost.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Shop items cost</span>
                    <span>${receiptDraft.ordersCost.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2 font-semibold">
                    <span>Total</span>
                    <span>${receiptDraft.totalPrice.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Payment method</p>
                  <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Visa">Visa</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    If selected, every {TABLE_TIME_OFFER.playedMinutes} played minutes are billed as {TABLE_TIME_OFFER.billedMinutes} minutes.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Add Receipt To Table</p>
                  <Select value={receiptTargetTableId} onValueChange={setReceiptTargetTableId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select table" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map((table) => (
                        <SelectItem
                          key={`receipt-target-${table.id}`}
                          value={String(table.id)}
                          disabled={Boolean(receiptDraft && table.id !== receiptDraft.tableId && table.isActive)}
                        >
                          {table.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choosing another idle table will continue this bill there, then you can close one final receipt later.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={closeDraft} disabled={submittingReceipt}>
                Cancel
              </Button>
              <Button onClick={handleDone} disabled={!receiptDraft || submittingReceipt}>
                {submittingReceipt ? 'Saving...' : 'Done'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Index;
