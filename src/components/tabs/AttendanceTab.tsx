import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { attendEmployee, leaveEmployee } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { Clock, LogOut } from 'lucide-react';

const AttendanceTab = () => {
  const { toast } = useToast();
  const [attendId, setAttendId] = useState('');
  const [leaveId, setLeaveId] = useState('');

  const handleAttend = async () => {
    if (!attendId) return;
    try {
      await attendEmployee(Number(attendId));
      toast({ title: 'Clocked in' });
      setAttendId('');
    } catch { toast({ title: 'Failed to clock in', variant: 'destructive' }); }
  };

  const handleLeave = async () => {
    if (!leaveId) return;
    try {
      await leaveEmployee(Number(leaveId));
      toast({ title: 'Clocked out' });
      setLeaveId('');
    } catch { toast({ title: 'Failed to clock out', variant: 'destructive' }); }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Clock In</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Employee ID" type="number" value={attendId} onChange={e => setAttendId(e.target.value)} />
          <Button onClick={handleAttend} className="w-full">Clock In</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><LogOut className="h-5 w-5" /> Clock Out</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Employee ID" type="number" value={leaveId} onChange={e => setLeaveId(e.target.value)} />
          <Button onClick={handleLeave} className="w-full">Clock Out</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceTab;
