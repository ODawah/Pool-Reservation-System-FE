import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createExpense, getExpenses } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import type { ExpenseRecord } from '@/types/pool-hall';
import { Receipt } from 'lucide-react';

const ExpensesTab = () => {
  const { toast } = useToast();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadExpenses = async () => {
    try {
      const data = await getExpenses();
      setExpenses(data);
    } catch {
      toast({ title: 'Failed to load expenses', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleCreate = async () => {
    if (!description || !amount) return;
    try {
      setSaving(true);
      await createExpense(description, Number(amount));
      setDescription('');
      setAmount('');
      await loadExpenses();
      toast({ title: 'Expense recorded' });
    } catch {
      toast({ title: 'Failed to create expense', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  return (
    <div className="space-y-4">
      <Card className="max-w-md">
        <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Record Expense</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
          <Input placeholder="Amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          <Button onClick={handleCreate} className="w-full" disabled={saving}>
            {saving ? 'Saving...' : 'Record'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Expenses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-muted-foreground">Loading expenses...</p>
          ) : expenses.length === 0 ? (
            <p className="text-muted-foreground">No expenses found.</p>
          ) : (
            expenses.map((expense) => (
              <div key={expense.id ?? `${expense.description}-${expense.amount}-${expense.date}`} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{expense.description}</p>
                  <p className="font-semibold">${expense.amount.toFixed(2)}</p>
                </div>
                <p className="text-sm text-muted-foreground">{formatDate(expense.date)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpensesTab;
