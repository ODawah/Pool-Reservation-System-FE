import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { isAuthenticated, loginWithPassword } from '@/lib/auth';
import { LockKeyhole } from 'lucide-react';

const Login = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fromPath =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';

  if (isAuthenticated()) {
    return <Navigate to={fromPath === '/login' ? '/' : fromPath} replace />;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    const isValid = loginWithPassword(password);
    if (!isValid) {
      toast({
        title: 'Wrong password',
        description: 'Please enter the correct password to continue.',
        variant: 'destructive',
      });
      setSubmitting(false);
      return;
    }

    navigate(fromPath === '/login' ? '/' : fromPath, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background felt-texture flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-border/60 bg-card/90 backdrop-blur">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
            <LockKeyhole className="h-5 w-5 text-primary" />
            Enter Password
          </CardTitle>
          <CardDescription>
            This app is locked. Enter the password to access the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
            />
            <Button type="submit" className="w-full" disabled={!password || submitting}>
              {submitting ? 'Checking...' : 'Unlock'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
