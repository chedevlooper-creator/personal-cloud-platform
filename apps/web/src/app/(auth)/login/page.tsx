'use client';

import { useState } from 'react';
import type React from 'react';
import { SquareTerminal } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin } from '@/lib/auth';
import {toastApiError} from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const loginMutation = useLogin();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { email, password },
      {
        onError: (error) => {
          toastApiError(error, 'Login failed. Please check your credentials.');
        },
      }
    );
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <SquareTerminal className="h-5 w-5" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Tekrar hoş geldiniz</h1>
            <p className="mt-1 text-sm text-muted-foreground">Zihinbulut’a giriş yapın</p>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-xl border border-border bg-card p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">E-posta</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">Parola</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? 'Giriş yapılıyor...' : 'Giriş yap'}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Hesabınız yok mu?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Kayıt olun
          </Link>
        </p>
      </div>
    </div>
  );
}
