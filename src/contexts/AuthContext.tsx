import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  specialty?: string;
}

interface TenantMembership {
  tenantId: string;
  role: string;
  tenant: { name: string; slug: string };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  memberships: TenantMembership[];
  activeTenantId: string | null;
  switchTenant: (tenantId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      fetchUser(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUser = async (authToken: string) => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setMemberships(data.memberships || []);
        const storedTenant = localStorage.getItem('tenantId');
        const selected = data.memberships?.some((item: TenantMembership) => item.tenantId === storedTenant)
          ? storedTenant
          : data.memberships?.[0]?.tenantId || null;
        setActiveTenantId(selected);
        if (selected) localStorage.setItem('tenantId', selected);
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('tenantId');
        setToken(null);
        setUser(null);
        setMemberships([]);
        setActiveTenantId(null);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('tenantId');
      setToken(null);
      setUser(null);
      setMemberships([]);
      setActiveTenantId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    setMemberships(data.memberships || []);
    const selected = data.memberships?.[0]?.tenantId || null;
    setActiveTenantId(selected);
    if (selected) localStorage.setItem('tenantId', selected);
    router.push('/dashboard');
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('tenantId');
      setToken(null);
      setUser(null);
      setMemberships([]);
      setActiveTenantId(null);
      router.push('/login');
    }
  };

  const switchTenant = (tenantId: string) => {
    if (!memberships.some((membership) => membership.tenantId === tenantId)) return;
    localStorage.setItem('tenantId', tenantId);
    setActiveTenantId(tenantId);
    router.reload();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
        memberships,
        activeTenantId,
        switchTenant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
