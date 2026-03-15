import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createReceipt, getReceipts, getShopItems, getTables } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import type { Receipt, ReceiptPayload, ShopItem, TableInfo } from '@/types/pool-hall';
import { Coffee, DollarSign, FileText, Minus, Plus } from 'lucide-react';

type PaymentMethod = 'Cash' | 'Visa';

interface ManualReceiptForm {
  tableId: string;
  minutes: string;
  extraAmount: string;
  paymentType: PaymentMethod;
  receiptTime: string;
  notes: string;
}

interface ManualOrder {
  shopItem: ShopItem;
  quantity: number;
}

const toDateTimeLocalValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const RevenueTab = () => {
  const { toast } = useToast();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(true);
  const [loadingTables, setLoadingTables] = useState(true);
  const [loadingShopItems, setLoadingShopItems] = useState(true);
  const [savingManualReceipt, setSavingManualReceipt] = useState(false);
  const [showManualReceiptForm, setShowManualReceiptForm] = useState(false);
  const [showShopItemsMenu, setShowShopItemsMenu] = useState(false);
  const [manualOrders, setManualOrders] = useState<ManualOrder[]>([]);
  const [manualForm, setManualForm] = useState<ManualReceiptForm>({
    tableId: '',
    minutes: '60',
    extraAmount: '0',
    paymentType: 'Cash',
    receiptTime: toDateTimeLocalValue(new Date()),
    notes: '',
  });

  const loadReceipts = useCallback(async () => {
    try {
      const data = await getReceipts();
      setReceipts(data);
    } catch {
      toast({ title: 'Failed to load receipts', variant: 'destructive' });
    } finally {
      setLoadingReceipts(false);
    }
  }, [toast]);

  const loadTables = useCallback(async () => {
    try {
      const data = await getTables();
      setTables(data);
    } catch {
      toast({ title: 'Failed to load tables', variant: 'destructive' });
    } finally {
      setLoadingTables(false);
    }
  }, [toast]);

  const loadShopItems = useCallback(async () => {
    try {
      const data = await getShopItems();
      setShopItems(data);
    } catch {
      toast({ title: 'Failed to load shop items', variant: 'destructive' });
    } finally {
      setLoadingShopItems(false);
    }
  }, [toast]);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  useEffect(() => {
    loadTables();
    loadShopItems();
  }, [loadTables, loadShopItems]);

  const sortedReceipts = useMemo(() => {
    return [...receipts].sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [receipts]);

  const totalRevenue = useMemo(() => {
    return receipts.reduce((sum, receipt) => sum + receipt.total_price, 0);
  }, [receipts]);

  const selectedTable = useMemo(() => {
    return tables.find((table) => table.id === Number(manualForm.tableId)) || null;
  }, [tables, manualForm.tableId]);

  const manualMinutes = Math.max(0, Number(manualForm.minutes) || 0);
  const manualExtraAmount = Math.max(0, Number(manualForm.extraAmount) || 0);

  const manualShopItemsCost = useMemo(() => {
    return manualOrders.reduce((sum, order) => sum + order.shopItem.price * order.quantity, 0);
  }, [manualOrders]);

  const manualTimeCost = selectedTable ? manualMinutes * selectedTable.price : 0;
  const manualTotal = manualTimeCost + manualShopItemsCost + manualExtraAmount;

  const renderItems = (items: Record<string, unknown>) => {
    const entries = Object.entries(items || {});
    if (entries.length === 0) {
      return <p className="text-sm text-muted-foreground">No items recorded</p>;
    }

    return (
      <div className="space-y-1">
        {entries.map(([name, value]) => (
          <div key={name} className="flex justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{name}</span>
            <span className="font-medium text-right">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
          </div>
        ))}
      </div>
    );
  };

  const handleAddManualShopItem = (item: ShopItem) => {
    setManualOrders((prev) => {
      const existing = prev.findIndex((order) => order.shopItem.name === item.name);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], quantity: next[existing].quantity + 1 };
        return next;
      }
      return [...prev, { shopItem: item, quantity: 1 }];
    });
  };

  const handleRemoveManualShopItem = (itemIndex: number) => {
    setManualOrders((prev) => {
      const next = [...prev];
      if (next[itemIndex].quantity > 1) {
        next[itemIndex] = { ...next[itemIndex], quantity: next[itemIndex].quantity - 1 };
      } else {
        next.splice(itemIndex, 1);
      }
      return next;
    });
  };

  const handleCreateManualReceipt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const tableId = Number(manualForm.tableId);
    const minutes = Number(manualForm.minutes);
    const extraAmount = Number(manualForm.extraAmount);

    if (!tableId) {
      toast({ title: 'Table is required', variant: 'destructive' });
      return;
    }

    if (!Number.isFinite(minutes) || minutes <= 0) {
      toast({ title: 'Minutes must be greater than 0', variant: 'destructive' });
      return;
    }

    if (!Number.isFinite(extraAmount) || extraAmount < 0) {
      toast({ title: 'Extra amount cannot be negative', variant: 'destructive' });
      return;
    }

    const table = tables.find((item) => item.id === tableId);
    if (!table) {
      toast({ title: 'Invalid table selection', variant: 'destructive' });
      return;
    }

    const receiptTime = manualForm.receiptTime ? new Date(manualForm.receiptTime) : new Date();
    if (Number.isNaN(receiptTime.getTime())) {
      toast({ title: 'Invalid receipt time', variant: 'destructive' });
      return;
    }

    const items: Record<string, unknown> = { Time: minutes, 'Manual receipt': true };

    manualOrders.forEach((order) => {
      items[order.shopItem.name] = order.quantity;
    });

    if (extraAmount > 0) {
      items['Manual extra'] = extraAmount;
    }

    if (manualForm.notes.trim()) {
      items.Notes = manualForm.notes.trim();
    }

    const payload: ReceiptPayload = {
      table_id: tableId,
      items,
      total_price: minutes * table.price + manualShopItemsCost + extraAmount,
      payment_type: manualForm.paymentType,
      timestamp: receiptTime.toISOString(),
    };

    try {
      setSavingManualReceipt(true);
      await createReceipt(payload);
      await Promise.all([loadReceipts(), loadShopItems()]);

      toast({
        title: 'Manual receipt created',
        description: `${table.name} - $${payload.total_price.toFixed(2)}`,
      });

      setManualForm({
        tableId: '',
        minutes: '60',
        extraAmount: '0',
        paymentType: 'Cash',
        receiptTime: toDateTimeLocalValue(new Date()),
        notes: '',
      });
      setManualOrders([]);
      setShowShopItemsMenu(false);
    } catch {
      toast({ title: 'Failed to create manual receipt', variant: 'destructive' });
    } finally {
      setSavingManualReceipt(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> Revenue Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">Total receipts: {receipts.length}</p>
          <p className="text-xl font-bold">${totalRevenue.toFixed(2)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Manual Receipt Entry
            </CardTitle>
            <Button
              type="button"
              variant={showManualReceiptForm ? 'secondary' : 'outline'}
              onClick={() => setShowManualReceiptForm((prev) => !prev)}
            >
              {showManualReceiptForm ? 'Hide Manual Receipt' : 'Open Manual Receipt'}
            </Button>
          </div>
        </CardHeader>

        {showManualReceiptForm && (
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateManualReceipt}>
              <div className="space-y-2">
                <Label>Table</Label>
                <Select
                  value={manualForm.tableId}
                  onValueChange={(value) => setManualForm((prev) => ({ ...prev, tableId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingTables ? 'Loading tables...' : 'Select table'} />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((table) => (
                      <SelectItem key={`manual-receipt-table-${table.id}`} value={String(table.id)}>
                        {table.name} (${table.price}/min)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Played Minutes</Label>
                <Input
                  type="number"
                  min={1}
                  value={manualForm.minutes}
                  onChange={(event) => setManualForm((prev) => ({ ...prev, minutes: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Extra Amount</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={manualForm.extraAmount}
                  onChange={(event) => setManualForm((prev) => ({ ...prev, extraAmount: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={manualForm.paymentType}
                  onValueChange={(value) => setManualForm((prev) => ({ ...prev, paymentType: value as PaymentMethod }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Visa">Visa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Receipt Time</Label>
                <Input
                  type="datetime-local"
                  value={manualForm.receiptTime}
                  onChange={(event) => setManualForm((prev) => ({ ...prev, receiptTime: event.target.value }))}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Notes</Label>
                <Input
                  value={manualForm.notes}
                  onChange={(event) => setManualForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Optional note for this manual receipt"
                />
              </div>

              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowShopItemsMenu((prev) => !prev)}
                >
                  <Coffee className="h-4 w-4" />
                  {showShopItemsMenu ? 'Hide Shop Items' : 'Add Shop Items'}
                </Button>
                <p className="text-sm text-muted-foreground">
                  {manualOrders.length === 0
                    ? 'No shop items added'
                    : `${manualOrders.length} shop item type(s) added`}
                </p>
              </div>

              {showShopItemsMenu && (
                <div className="md:col-span-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {loadingShopItems ? (
                    <p className="col-span-full py-2 text-sm text-muted-foreground">Loading shop items...</p>
                  ) : shopItems.length === 0 ? (
                    <p className="col-span-full py-2 text-sm text-muted-foreground">No shop items available</p>
                  ) : (
                    shopItems.map((item) => (
                      <Button
                        key={item.id ?? item.name}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 justify-between text-xs hover:border-accent hover:text-accent"
                        onClick={() => handleAddManualShopItem(item)}
                        disabled={item.quantity <= 0}
                      >
                        <span className="truncate">{item.name}</span>
                        <span className="ml-1 text-muted-foreground">${item.price}<span className="opacity-60"> ({item.quantity})</span></span>
                      </Button>
                    ))
                  )}
                </div>
              )}

              {manualOrders.length > 0 && (
                <div className="md:col-span-2 space-y-1 rounded-lg bg-muted/60 p-3 text-sm">
                  {manualOrders.map((order, index) => (
                    <div key={`${order.shopItem.name}-${index}`} className="flex items-center justify-between">
                      <span className="text-foreground/80">{order.shopItem.name} x {order.quantity}</span>
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-accent">${(order.shopItem.price * order.quantity).toFixed(2)}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveManualShopItem(index)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground hover:text-primary"
                          onClick={() => handleAddManualShopItem(order.shopItem)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  <div className="mt-1.5 flex justify-between border-t border-border/50 pt-1.5 font-semibold text-accent">
                    <span>Shop items total</span>
                    <span>${manualShopItemsCost.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="space-y-1 rounded-md border p-3 text-sm md:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Time cost</span>
                  <span>${manualTimeCost.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Shop items cost</span>
                  <span>${manualShopItemsCost.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Extra amount</span>
                  <span>${manualExtraAmount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2 font-semibold">
                  <span>Total</span>
                  <span>${manualTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="md:col-span-2">
                <Button
                  type="submit"
                  disabled={savingManualReceipt || loadingTables || tables.length === 0}
                >
                  {savingManualReceipt ? 'Saving...' : 'Create Manual Receipt'}
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {loadingReceipts ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" /> Receipts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Loading receipts...</p>
          </CardContent>
        </Card>
      ) : sortedReceipts.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-muted-foreground">No receipts found.</p>
          </CardContent>
        </Card>
      ) : (
        sortedReceipts.map((receipt) => (
          <Card key={receipt.id}>
            <CardHeader>
              <CardTitle className="text-base">
                Receipt #{receipt.id} - Table {receipt.table_id}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{formatTimestamp(receipt.timestamp)}</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment</span>
                <span className="font-medium">{receipt.payment_type || '-'}</span>
              </div>
              {renderItems(receipt.items)}
              <p className="pt-1 text-right font-semibold">${receipt.total_price.toFixed(2)}</p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default RevenueTab;
