import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createEmployee, deleteEmployee } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Trash2 } from 'lucide-react';

const EmployeesTab = () => {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [salary, setSalary] = useState('');
  const [deleteId, setDeleteId] = useState('');

  const handleCreate = async () => {
    if (!name || !role || !salary) return;
    try {
      await createEmployee(name, role, Number(salary));
      toast({ title: 'Employee created' });
      setName(''); setRole(''); setSalary('');
    } catch { toast({ title: 'Failed to create employee', variant: 'destructive' }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteEmployee(Number(deleteId));
      toast({ title: 'Employee deleted' });
      setDeleteId('');
    } catch { toast({ title: 'Failed to delete employee', variant: 'destructive' }); }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Add Employee</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
          <Input placeholder="Role" value={role} onChange={e => setRole(e.target.value)} />
          <Input placeholder="Salary" type="number" value={salary} onChange={e => setSalary(e.target.value)} />
          <Button onClick={handleCreate} className="w-full">Create</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5" /> Delete Employee</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Employee ID" type="number" value={deleteId} onChange={e => setDeleteId(e.target.value)} />
          <Button onClick={handleDelete} variant="destructive" className="w-full">Delete</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeesTab;
