import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createRevenue } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { DollarSign } from 'lucide-react';

const RevenueTab = () => {
  const { toast } = useToast();
  const [source, setSource] = useState<string>('cash');
  const [amount, setAmount] = useState('');

  const handleCreate = async () => {
    if (!amount) return;
    try {
      await createRevenue(source, Number(amount));
      toast({ title: 'Revenue recorded' });
      setAmount('');
    } catch { toast({ title: 'Failed to record revenue', variant: 'destructive' }); }
  };

  return (
    <Card className="max-w-md">
      <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Record Revenue</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="visa">Visa</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
        <Button onClick={handleCreate} className="w-full">Record</Button>
      </CardContent>
    </Card>
  );
};

export default RevenueTab;
