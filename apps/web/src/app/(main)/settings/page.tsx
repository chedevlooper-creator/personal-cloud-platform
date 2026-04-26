'use client';

import { useState } from 'react';
import {
  Eye,
  EyeOff,
  Key,
  Monitor,
  Moon,
  Palette,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  User,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { useUser, useLogout } from '@/lib/auth';
import { cn } from '@/lib/utils';

type SettingsTab = 'profile' | 'ai-providers' | 'models' | 'workspace' | 'terminal' | 'theme' | 'danger';

const settingsTabs: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'ai-providers', label: 'AI Providers', icon: Key },
  { id: 'models', label: 'Models', icon: Sparkles },
  { id: 'workspace', label: 'Workspace', icon: Monitor },
  { id: 'terminal', label: 'Terminal Policy', icon: Shield },
  { id: 'theme', label: 'Theme', icon: Palette },
  { id: 'danger', label: 'Danger Zone', icon: Trash2 },
];

export default function SettingsPage() {
  const { data: user } = useUser();
  const logoutMutation = useLogout();
  const { resolvedTheme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h2 className="text-lg font-semibold text-foreground">Settings</h2>
      <p className="text-sm text-muted-foreground">Manage your account and preferences</p>

      <div className="mt-6 flex gap-6">
        {/* Sidebar */}
        <nav className="hidden w-48 shrink-0 space-y-0.5 md:block">
          {settingsTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-6">
          {activeTab === 'profile' && (
            <section className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-base font-semibold text-foreground">Profile</h3>
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="settings-name">Name</Label>
                  <Input id="settings-name" defaultValue={user?.name || ''} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settings-email">Email</Label>
                  <Input id="settings-email" defaultValue={user?.email || ''} readOnly className="opacity-60" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm">Save changes</Button>
                  <Button size="sm" variant="outline" onClick={() => logoutMutation.mutate()}>
                    Sign out
                  </Button>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'ai-providers' && (
            <section className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-base font-semibold text-foreground">AI Providers</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                API keys are encrypted with AES-256-GCM before storage.
              </p>
              <div className="mt-4 space-y-4">
                {[
                  { name: 'OpenAI', placeholder: 'sk-...', saved: false },
                  { name: 'Anthropic', placeholder: 'sk-ant-...', saved: false },
                  { name: 'Google AI', placeholder: 'AI...', saved: false },
                ].map((provider) => (
                  <div key={provider.name} className="flex items-end gap-3 rounded-lg border border-border p-4">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label>{provider.name}</Label>
                        {provider.saved ? (
                          <StatusBadge variant="success">Connected</StatusBadge>
                        ) : (
                          <StatusBadge variant="default">Not set</StatusBadge>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          type={apiKeyVisible ? 'text' : 'password'}
                          placeholder={provider.placeholder}
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                          onClick={() => setApiKeyVisible(!apiKeyVisible)}
                        >
                          {apiKeyVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    <Button size="sm">Save</Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'models' && (
            <section className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-base font-semibold text-foreground">Default Model</h3>
              <p className="mt-1 text-sm text-muted-foreground">Select the AI model for new conversations.</p>
              <div className="mt-4 space-y-2">
                {['Mock AI (Free)', 'GPT-4', 'GPT-4o', 'Claude 3.5 Sonnet', 'Gemini 2.0 Flash'].map((model, i) => (
                  <button
                    key={model}
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors',
                      i === 0
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border text-muted-foreground hover:border-primary/30 hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      <span className="font-medium">{model}</span>
                    </div>
                    {i === 0 && <StatusBadge variant="success">Active</StatusBadge>}
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'workspace' && (
            <section className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-base font-semibold text-foreground">Workspace Storage</h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-semibold text-foreground">0 B</span>
                  <span className="text-sm text-muted-foreground">of 10 GB</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: '0%' }} />
                </div>
                <p className="text-xs text-muted-foreground">Storage includes all files, snapshots, and hosted site assets.</p>
              </div>
            </section>
          )}

          {activeTab === 'terminal' && (
            <section className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-base font-semibold text-foreground">Terminal Security Policy</h3>
              <p className="mt-1 text-sm text-muted-foreground">Configure which commands require approval.</p>
              <div className="mt-4 space-y-3">
                {[
                  { level: 'Strict', desc: 'All commands require approval' },
                  { level: 'Balanced', desc: 'Risky commands require approval (default)' },
                  { level: 'Permissive', desc: 'Only blocked commands are prevented' },
                ].map((policy, i) => (
                  <button
                    key={policy.level}
                    type="button"
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                      i === 1
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30 hover:bg-muted'
                    )}
                  >
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <span className="text-sm font-medium text-foreground">{policy.level}</span>
                      <p className="text-xs text-muted-foreground">{policy.desc}</p>
                    </div>
                    {i === 1 && <StatusBadge variant="info" className="ml-auto">Active</StatusBadge>}
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'theme' && (
            <section className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-base font-semibold text-foreground">Appearance</h3>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { value: 'light', label: 'Light', icon: Sun },
                  { value: 'dark', label: 'Dark', icon: Moon },
                  { value: 'system', label: 'System', icon: Monitor },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border px-4 py-4 transition-colors',
                      resolvedTheme === option.value || (option.value === 'system' && !['light', 'dark'].includes(resolvedTheme || ''))
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/30 hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <option.icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'danger' && (
            <section className="rounded-xl border border-destructive/30 bg-card p-6">
              <h3 className="text-base font-semibold text-destructive">Danger Zone</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Permanently delete your account and all associated data.
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="mt-4"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete Account
              </Button>
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete account"
        description="This will permanently delete your account, all workspaces, files, conversations, automations, and hosted services. This action cannot be undone."
        confirmLabel="Delete everything"
        variant="destructive"
        onConfirm={async () => {
          // Would call API to delete account
        }}
      />
    </div>
  );
}
