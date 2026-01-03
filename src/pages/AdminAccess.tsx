import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle } from 'lucide-react';
import AccountsManagement from '@/components/admin/AccountsManagement';
import PromptTemplatesManager from '@/components/admin/PromptTemplatesManager';

const AdminAccess = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    // Get credentials from environment - no defaults for security
    const adminUsername = import.meta.env.VITE_ADMIN_USERNAME;
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;

    // Check if credentials are configured
    if (!adminUsername || !adminPassword) {
      setError('Admin credentials not configured. Set VITE_ADMIN_USERNAME and VITE_ADMIN_PASSWORD environment variables.');
      return;
    }

    if (username === adminUsername && password === adminPassword) {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Invalid credentials');
      setPassword('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-6 w-6 text-indigo-600" />
              <CardTitle className="text-2xl">Admin Access</CardTitle>
            </div>
            <CardDescription>
              Enter admin credentials to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">
                  Username
                </label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-8 w-8 text-indigo-600" />
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          </div>
          <p className="text-slate-600">Manage accounts and view system configuration</p>
        </div>

        <Tabs defaultValue="accounts" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="prompts">Prompt Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="space-y-4">
            <AccountsManagement />
          </TabsContent>

          <TabsContent value="prompts" className="space-y-4">
            <PromptTemplatesManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminAccess;
