import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
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
import type { TableSession, ShopItem, ReceiptPayload, TableInfo } from '@/types/pool-hall';
import { CalendarClock, LogOut } from 'lucide-react';

type PaymentMethod = 'Cash' | 'Visa';

interface DraftReceipt {
  tableId: number;
  tableLabel: string;
  totalMinutes: number;
  timeCost: number;
  ordersCost: number;
  totalPrice: number;
  items: Record<string, number>;
}

const typeFromName = (name: string): 'pool' | 'carrom' | 'ps' => {
  const lower = name.toLowerCase();
  if (lower.includes('carrom')) return 'carrom';
  if (lower.includes('ps')) return 'ps';
  return 'pool';
};

const Index = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tables, setTables] = useState<TableSession[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [receiptDraft, setReceiptDraft] = useState<DraftReceipt | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [submittingReceipt, setSubmittingReceipt] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [tableData, items] = await Promise.all([getTables(), getShopItems()]);
      setShopItems(items);
      setTables(prev => {
        // Merge API table info with existing session state
        return tableData.map((t: TableInfo) => {
          const existing = prev.find(p => p.id === t.id);
          return existing
            ? { ...existing, label: t.name, pricePerMinute: t.price }
            : { id: t.id, label: t.name, type: typeFromName(t.name), isActive: false, startTime: null, orders: [], pricePerMinute: t.price };
        });
      });
    } catch {
      console.error('Failed to fetch data');
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStart = (id: number) => {
    setTables(prev => prev.map(t => t.id === id ? { ...t, isActive: true, startTime: Date.now() } : t));
  };

  const handleStop = (id: number) => {
    const table = tables.find(t => t.id === id);
    if (!table || !table.startTime) return;

    const totalMinutes = Math.round((Date.now() - table.startTime) / 60000);
    const timeCost = totalMinutes * table.pricePerMinute;
    const ordersCost = table.orders.reduce((s, o) => s + o.shopItem.price * o.quantity, 0);

    // Build items as { name: qty } dict
    const items: Record<string, number> = {};
    table.orders.forEach(o => {
      items[o.shopItem.name] = (items[o.shopItem.name] || 0) + o.quantity;
    });
    items.Time = totalMinutes;

    setPaymentMethod('Cash');
    setReceiptDraft({
      tableId: table.id,
      tableLabel: table.label,
      totalMinutes,
      timeCost,
      ordersCost,
      totalPrice: timeCost + ordersCost,
      items,
    });
  };

  const closeDraft = () => {
    if (submittingReceipt) return;
    setReceiptDraft(null);
  };

  const handleDone = async () => {
    if (!receiptDraft) return;

    const receipt: ReceiptPayload = {
      table_id: receiptDraft.tableId,
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
        description: `${receiptDraft.tableLabel} — ${paymentMethod} — $${receipt.total_price.toFixed(2)}`,
      });
      setTables(prev => prev.map(t => (
        t.id === receiptDraft.tableId ? { ...t, isActive: false, startTime: null, orders: [] } : t
      )));
      setReceiptDraft(null);
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
                <div className="space-y-1">
                  {Object.entries(receiptDraft.items).map(([name, quantity]) => (
                    <div key={name} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{name}</span>
                      <span className="font-medium">{quantity}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 rounded-md border p-3 text-sm">
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
