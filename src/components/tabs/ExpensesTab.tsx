import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createExpense } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { Receipt } from 'lucide-react';

const ExpensesTab = () => {
  const { toast } = useToast();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const handleCreate = async () => {
    if (!description || !amount) return;
    try {
      await createExpense({ description, amount: Number(amount) });
      toast({ title: 'Expense recorded' });
      setDescription(''); setAmount('');
    } catch { toast({ title: 'Failed to record expense', variant: 'destructive' }); }
  };

  return (
    <Card className="max-w-md">
      <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Record Expense</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
        <Input placeholder="Amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
        <Button onClick={handleCreate} className="w-full">Record</Button>
      </CardContent>
    </Card>
  );
};

export default ExpensesTab;
