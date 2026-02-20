import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TableCard from '@/components/TableCard';
import EmployeesTab from '@/components/tabs/EmployeesTab';
import AttendanceTab from '@/components/tabs/AttendanceTab';
import RevenueTab from '@/components/tabs/RevenueTab';
import ExpensesTab from '@/components/tabs/ExpensesTab';
import { getShopItems, getTables, createReceipt } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import type { TableSession, ShopItem, ReceiptPayload, TableInfo } from '@/types/pool-hall';

const typeFromName = (name: string): 'pool' | 'carrom' | 'ps' => {
  const lower = name.toLowerCase();
  if (lower.includes('carrom')) return 'carrom';
  if (lower.includes('ps')) return 'ps';
  return 'pool';
};

const Index = () => {
  const { toast } = useToast();
  const [tables, setTables] = useState<TableSession[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);

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

  const handleStop = async (id: number) => {
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

    const receipt: ReceiptPayload = {
      table_id: table.id,
      items,
      total_price: timeCost + ordersCost,
    };

    try {
      await createReceipt(receipt);
      toast({ title: `Receipt created`, description: `${table.label} — $${receipt.total_price.toFixed(2)}` });
      setTables(prev => prev.map(t => t.id === id ? { ...t, isActive: false, startTime: null, orders: [] } : t));
      fetchData();
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
      </main>
    </div>
  );
};

export default Index;
