'use client';

import { useState } from 'react';
import type React from 'react';
import { BrainCircuit, Loader2, ArrowRight, Mail, Lock, User } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRegister } from '@/lib/auth';
import { toastApiError } from '@/lib/api';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const registerMutation = useRegister();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate(
      { email, password, name: name.trim() || undefined },
      {
        onError: (error) => {
          toastApiError(error, 'Registration failed.');
        },
      },
    );
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="aurora-bg" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.4] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
        style={{
          backgroundImage:
            'linear-gradient(color-mix(in oklch, var(--border) 40%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklch, var(--border) 40%, transparent) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex flex-col items-center gap-4">
          <div
            className="relative flex h-12 w-12 items-center justify-center rounded-2xl text-primary-foreground shadow-[0_8px_24px_-6px_color-mix(in_oklch,var(--primary)_55%,transparent)]"
            style={{
              backgroundImage:
                'linear-gradient(135deg, var(--chart-1), var(--chart-4) 60%, var(--chart-1))',
            }}
          >
            <BrainCircuit className="h-6 w-6 relative z-10" />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(120%_120%_at_30%_20%,white/30,transparent_55%)]"
            />
          </div>
          <div className="text-center">
            <h1 className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-2xl font-semibold tracking-tight text-transparent">
              Hesap oluşturun
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Zihinbulut&apos;a katılın</p>
          </div>
        </div>

        <div className="glass gradient-border rounded-2xl p-6 shadow-[0_24px_70px_-30px_color-mix(in_oklch,var(--primary)_30%,transparent)]">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Adınız
              </Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Adınız"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="h-11 pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                E-posta
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11 pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Parola
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="En az 8 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  className="h-11 pl-9"
                />
              </div>
            </div>
            <Button
              type="submit"
              variant="gradient"
              size="lg"
              className="group h-11 w-full text-[14px] font-semibold"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Hesap oluşturuluyor…
                </>
              ) : (
                <>
                  Hesap oluştur
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Zaten hesabınız var mı?{' '}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Giriş yapın
          </Link>
        </p>
      </div>
    </div>
  );
}
