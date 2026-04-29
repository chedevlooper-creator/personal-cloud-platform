'use client';

import { useState } from 'react';
import type React from 'react';
import { SquareTerminal } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRegister } from '@/lib/auth';
import {toastApiError} from '@/lib/api';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const registerMutation = useRegister();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate(
      { email, password, name },
      {
        onError: (error) => {
          toastApiError(error, 'Registration failed.');
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
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Hesap oluşturun</h1>
            <p className="mt-1 text-sm text-muted-foreground">Zihinbulut’a katılın</p>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-xl border border-border bg-card p-6">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-foreground">Adınız</Label>
              <Input
                id="name"
                placeholder="Adınız"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
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
                placeholder="En az 8 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? 'Hesap oluşturuluyor...' : 'Hesap oluştur'}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Zaten hesabınız var mı?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Giriş yapın
          </Link>
        </p>
      </div>
    </div>
  );
}
