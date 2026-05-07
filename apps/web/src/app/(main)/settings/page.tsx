'use client';

import { useState } from 'react';
import type React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Plus,
  Loader2,
  Check,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { useUser, useLogout } from '@/lib/auth';
import { authApi, workspaceApi } from '@/lib/api';
import { toastApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useWorkspaceStore } from '@/store/workspace';

type SettingsTab =
  | 'profile'
  | 'ai-providers'
  | 'models'
  | 'workspace'
  | 'terminal'
  | 'theme'
  | 'danger';
type TerminalPolicy = 'strict' | 'normal' | 'permissive';

type UserPreferences = {
  bio?: string;
  terminalRiskLevel?: TerminalPolicy;
  theme?: string;
  defaultModel?: string;
};

const settingsTabs: {
  id: SettingsTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'ai-providers', label: 'AI Providers', icon: Key },
  { id: 'models', label: 'Models', icon: Sparkles },
  { id: 'workspace', label: 'Workspace', icon: Monitor },
  { id: 'terminal', label: 'Terminal Policy', icon: Shield },
  { id: 'theme', label: 'Theme', icon: Palette },
  { id: 'danger', label: 'Danger Zone', icon: Trash2 },
];

const PROVIDER_OPTIONS = [
  { value: 'minimax', label: 'MiniMax', placeholder: 'sk-...' },
  { value: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
  { value: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...' },
  { value: 'google', label: 'Google AI', placeholder: 'AI...' },
];

const TERMINAL_POLICIES: { level: TerminalPolicy; label: string; desc: string }[] = [
  { level: 'strict', label: 'Strict', desc: 'All commands require approval' },
  { level: 'normal', label: 'Balanced', desc: 'Risky commands require approval (default)' },
  { level: 'permissive', label: 'Permissive', desc: 'Only blocked commands are prevented' },
];

export default function SettingsPage() {
  const { data: user } = useUser();
  const logoutMutation = useLogout();
  const { resolvedTheme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // --- Preferences ---
  const { data: prefs } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      const res = await authApi.get('/user/preferences');
      return res.data as UserPreferences;
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name?: string; bio?: string }) => {
      await authApi.patch('/user/profile', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      toast.success('Profile updated');
    },
    onError: (error) => toastApiError(error, 'Failed to update profile'),
  });

  const [terminalPolicyOverride, setTerminalPolicyOverride] = useState<TerminalPolicy | null>(null);
  const terminalPolicy = terminalPolicyOverride ?? prefs?.terminalRiskLevel ?? 'normal';

  const updatePrefsMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await authApi.patch('/user/preferences', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      toast.success('Preferences updated');
    },
    onError: (error) => toastApiError(error, 'Failed to update preferences'),
  });

  // --- Workspace Storage ---
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const { data: storageData } = useQuery({
    queryKey: ['workspace-storage', currentWorkspaceId],
    queryFn: async () => {
      if (!currentWorkspaceId) return { usedBytes: 0, totalBytes: 10 * 1024 * 1024 * 1024 };
      const res = await workspaceApi.get(`/workspaces/${currentWorkspaceId}/storage`);
      return res.data as { usedBytes: number; totalBytes: number };
    },
    enabled: !!currentWorkspaceId,
  });

  // --- Account Deletion ---
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      await authApi.delete('/user/account');
    },
    onSuccess: () => {
      toast.success('Account deleted');
      logoutMutation.mutate();
    },
    onError: (error) => toastApiError(error, 'Failed to delete account'),
  });

  // --- Provider Credentials ---
  const { data: providers, isLoading: providersLoading } = useQuery({
    queryKey: ['user-providers'],
    queryFn: async () => {
      const res = await authApi.get('/user/providers');
      return res.data as {
        id: string;
        provider: string;
        label: string | null;
        maskedKey: string;
        createdAt: string;
      }[];
    },
  });

  const [addingProvider, setAddingProvider] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState('');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  const addProviderMutation = useMutation({
    mutationFn: async ({
      provider,
      key,
      replaceId,
    }: {
      provider: string;
      key: string;
      replaceId?: string;
    }) => {
      await authApi.post('/user/providers', { provider, key, label: provider });
      if (replaceId) {
        // Rotate: revoke the previous credential after the new one is saved.
        await authApi.delete(`/user/providers/${replaceId}`);
      }
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['user-providers'] });
      setAddingProvider(null);
      setNewApiKey('');
      toast.success(vars.replaceId ? 'API key rotated' : 'API key saved and encrypted');
    },
    onError: () => toast.error('Failed to save API key'),
  });

  const revokeProviderMutation = useMutation({
    mutationFn: async (id: string) => {
      await authApi.delete(`/user/providers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-providers'] });
      toast.success('API key revoked');
    },
    onError: () => toast.error('Failed to revoke API key'),
  });

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h2 className="text-lg font-semibold text-foreground">Settings</h2>
      <p className="text-sm text-muted-foreground">Manage your account and preferences</p>

      <div className="mt-6 flex flex-col gap-6 md:flex-row">
        {/* Mobile Navigation */}
        <div className="md:hidden w-full">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as SettingsTab)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            {settingsTabs.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.label}
              </option>
            ))}
          </select>
        </div>

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
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
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
            <section className="rounded-2xl border border-border/70 bg-card/70 backdrop-blur-md p-6">
              <h3 className="text-base font-semibold text-foreground">Profile</h3>
              <div className="mt-4">
                <ProfileForm
                  userName={user?.name || ''}
                  userBio={prefs?.bio || ''}
                  onSave={(data) => updateProfileMutation.mutate(data)}
                  isPending={updateProfileMutation.isPending}
                />
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => logoutMutation.mutate()}>
                    Sign out
                  </Button>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'ai-providers' && (
            <section className="rounded-2xl border border-border/70 bg-card/70 backdrop-blur-md p-6">
              <h3 className="text-base font-semibold text-foreground">AI Providers</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                API keys are encrypted with AES-256-GCM before storage. We never store or log
                plaintext keys.
              </p>
              <div className="mt-4 space-y-4">
                {providersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  PROVIDER_OPTIONS.map((opt) => {
                    const existing = (providers || []).find((p) => p.provider === opt.value);
                    const isAdding = addingProvider === opt.value;

                    return (
                      <div
                        key={opt.value}
                        className="flex items-end gap-3 rounded-lg border border-border p-4"
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Label>{opt.label}</Label>
                            {existing ? (
                              <StatusBadge variant="success">Connected</StatusBadge>
                            ) : (
                              <StatusBadge variant="default">Not set</StatusBadge>
                            )}
                          </div>

                          {isAdding ? (
                            <div className="relative">
                              <Input
                                type={apiKeyVisible ? 'text' : 'password'}
                                placeholder={opt.placeholder}
                                value={newApiKey}
                                onChange={(e) => setNewApiKey(e.target.value)}
                                autoFocus
                              />
                              <button
                                type="button"
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                                onClick={() => setApiKeyVisible(!apiKeyVisible)}
                              >
                                {apiKeyVisible ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          ) : existing ? (
                            <div className="flex items-center gap-2">
                              <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground font-mono">
                                {existing.maskedKey}
                              </code>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setAddingProvider(opt.value);
                                  setNewApiKey('');
                                }}
                                title="Rotate (saves new key, revokes old one)"
                              >
                                Rotate
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => revokeProviderMutation.mutate(existing.id)}
                                disabled={revokeProviderMutation.isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : null}
                        </div>

                        {isAdding ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              onClick={() =>
                                addProviderMutation.mutate({
                                  provider: opt.value,
                                  key: newApiKey,
                                  replaceId: existing?.id,
                                })
                              }
                              disabled={!newApiKey || addProviderMutation.isPending}
                            >
                              {addProviderMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="mr-1 h-3.5 w-3.5" />
                              )}
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setAddingProvider(null);
                                setNewApiKey('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : existing ? null : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setAddingProvider(opt.value);
                              setNewApiKey('');
                            }}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" /> Add Key
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}

          {activeTab === 'models' && (
            <section className="rounded-2xl border border-border/70 bg-card/70 backdrop-blur-md p-6">
              <h3 className="text-base font-semibold text-foreground">Default Model</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Select the AI model for new conversations.
              </p>
              <div className="mt-4 space-y-2">
                {['MiniMax-M2.7', 'MiniMax-Text-01', 'GPT-4o', 'Claude 3.5 Sonnet', 'Gemini 2.0 Flash'].map(
                  (model) => (
                    <button
                      key={model}
                      type="button"
                      onClick={() => {
                        updatePrefsMutation.mutate({ defaultModel: model });
                      }}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors',
                        prefs?.defaultModel === model
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-border text-muted-foreground hover:border-primary/30 hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        <span className="font-medium">{model}</span>
                      </div>
                      {prefs?.defaultModel === model && <StatusBadge variant="success">Active</StatusBadge>}
                    </button>
                  ),
                )}
              </div>
            </section>
          )}

          {activeTab === 'workspace' && (
            <section className="rounded-2xl border border-border/70 bg-card/70 backdrop-blur-md p-6">
              <h3 className="text-base font-semibold text-foreground">Workspace Storage</h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-semibold text-foreground">
                    {storageData ? formatBytes(storageData.usedBytes) : '0 B'}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    of {storageData ? formatBytes(storageData.totalBytes) : '10 GB'}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{
                      width: storageData
                        ? `${Math.min((storageData.usedBytes / storageData.totalBytes) * 100, 100)}%`
                        : '0%',
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Storage includes all files, snapshots, and hosted site assets.
                </p>
              </div>
            </section>
          )}

          {activeTab === 'terminal' && (
            <section className="rounded-2xl border border-border/70 bg-card/70 backdrop-blur-md p-6">
              <h3 className="text-base font-semibold text-foreground">Terminal Security Policy</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Configure which commands require approval.
              </p>
              <div className="mt-4 space-y-3">
                {TERMINAL_POLICIES.map((policy) => (
                  <button
                    key={policy.level}
                    type="button"
                    onClick={() => {
                      setTerminalPolicyOverride(policy.level);
                      updatePrefsMutation.mutate({ terminalRiskLevel: policy.level });
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                      terminalPolicy === policy.level
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30 hover:bg-muted',
                    )}
                  >
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <span className="text-sm font-medium text-foreground">{policy.label}</span>
                      <p className="text-xs text-muted-foreground">{policy.desc}</p>
                    </div>
                    {terminalPolicy === policy.level && (
                      <StatusBadge variant="info" className="ml-auto">
                        Active
                      </StatusBadge>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'theme' && (
            <section className="rounded-2xl border border-border/70 bg-card/70 backdrop-blur-md p-6">
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
                    onClick={() => {
                      setTheme(option.value);
                      updatePrefsMutation.mutate({ theme: option.value });
                    }}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border px-4 py-4 transition-colors',
                      resolvedTheme === option.value ||
                        (option.value === 'system' &&
                          !['light', 'dark'].includes(resolvedTheme || ''))
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/30 hover:bg-muted hover:text-foreground',
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
        onOpenChange={(open) => {
          setShowDeleteConfirm(open);
          if (!open) setDeleteConfirmText('');
        }}
        title="Delete account"
        description="This will permanently delete your account, all workspaces, files, conversations, automations, and hosted services. This action cannot be undone."
        confirmLabel="Delete everything"
        variant="destructive"
        onConfirm={() => {
          deleteAccountMutation.mutate();
          setShowDeleteConfirm(false);
        }}
      >
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Type <strong className="text-destructive">DELETE</strong> to confirm:
          </p>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Type DELETE"
          />
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="mt-3 w-full"
          onClick={() => {
            deleteAccountMutation.mutate();
            setShowDeleteConfirm(false);
          }}
          disabled={deleteConfirmText !== 'DELETE' || deleteAccountMutation.isPending}
        >
          {deleteAccountMutation.isPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : null}
          Delete everything
        </Button>
      </ConfirmDialog>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function ProfileForm({
  userName,
  userBio,
  onSave,
  isPending,
}: {
  userName: string;
  userBio: string;
  onSave: (data: { name: string; bio: string }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(userName);
  const [bio, setBio] = useState(userBio);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="settings-name">Name</Label>
        <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="settings-bio">Bio</Label>
        <Input
          id="settings-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A short bio about yourself..."
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave({ name, bio })} disabled={isPending}>
          {isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          Save changes
        </Button>
      </div>
    </div>
  );
}
