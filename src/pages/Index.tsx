import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TableCard from '@/components/TableCard';
import EmployeesTab from '@/components/tabs/EmployeesTab';
import AttendanceTab from '@/components/tabs/AttendanceTab';
import RevenueTab from '@/components/tabs/RevenueTab';
import ExpensesTab from '@/components/tabs/ExpensesTab';
import { getShopItems, createReceipt } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import type { TableSession, ShopItem, ReceiptPayload } from '@/types/pool-hall';

const RATE_PER_MINUTE = 0.05;

const initialTables: TableSession[] = [
  { id: 1, label: 'Pool 1', type: 'pool', isActive: false, startTime: null, orders: [] },
  { id: 2, label: 'Pool 2', type: 'pool', isActive: false, startTime: null, orders: [] },
  { id: 3, label: 'Pool 3', type: 'pool', isActive: false, startTime: null, orders: [] },
  { id: 4, label: 'Pool 4', type: 'pool', isActive: false, startTime: null, orders: [] },
  { id: 5, label: 'Carrom', type: 'carrom', isActive: false, startTime: null, orders: [] },
  { id: 6, label: 'PS Room', type: 'ps', isActive: false, startTime: null, orders: [] },
];

const Index = () => {
  const { toast } = useToast();
  const [tables, setTables] = useState<TableSession[]>(initialTables);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);

  const fetchShop = useCallback(async () => {
    try {
      const items = await getShopItems();
      setShopItems(items);
    } catch {
      console.error('Failed to fetch shop items');
    }
  }, []);

  useEffect(() => { fetchShop(); }, [fetchShop]);

  const handleStart = (id: number) => {
    setTables(prev => prev.map(t => t.id === id ? { ...t, isActive: true, startTime: Date.now() } : t));
  };

  const handleStop = async (id: number) => {
    const table = tables.find(t => t.id === id);
    if (!table || !table.startTime) return;

    const totalMinutes = Math.round((Date.now() - table.startTime) / 60000);
    const timeCost = totalMinutes * RATE_PER_MINUTE;
    const ordersCost = table.orders.reduce((s, o) => s + o.shopItem.price * o.quantity, 0);

    const receipt: ReceiptPayload = {
      table_id: table.id,
      items: {
        table_time_minutes: totalMinutes,
        shop_items: table.orders.map(o => ({
          item_id: o.shopItem.id!,
          name: o.shopItem.name,
          qty: o.quantity,
          unit_price: o.shopItem.price,
        })),
      },
      total_price: timeCost + ordersCost,
    };

    try {
      await createReceipt(receipt);
      toast({ title: `Receipt created`, description: `${table.label} — $${receipt.total_price.toFixed(2)}` });
      setTables(prev => prev.map(t => t.id === id ? { ...t, isActive: false, startTime: null, orders: [] } : t));
      fetchShop();
    } catch {
      toast({ title: 'Failed to create receipt', variant: 'destructive' });
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

  return (
    <div className="min-h-screen bg-background felt-texture">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎱</span>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">The Lounge</h1>
            <p className="text-xs text-muted-foreground tracking-widest uppercase">Pool Hall Manager</p>
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
            </div>
          </TabsContent>
          <TabsContent value="employees"><EmployeesTab /></TabsContent>
          <TabsContent value="attendance"><AttendanceTab /></TabsContent>
          <TabsContent value="revenue"><RevenueTab /></TabsContent>
          <TabsContent value="expenses"><ExpensesTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
