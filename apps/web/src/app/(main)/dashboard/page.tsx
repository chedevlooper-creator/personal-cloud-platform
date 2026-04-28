'use client';

import {
  Camera,
  Clock3,
  FileText,
  FolderPlus,
  Globe2,
  HardDrive,
  MessageCircle,
  Plus,
  Sparkles,
  TerminalSquare,
  Upload,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';

function DashboardCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-3 text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted hover:text-foreground"
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Your workspace overview</p>
      </div>

      {/* Quick Actions */}
      <div className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <QuickAction icon={FileText} label="New file" onClick={() => router.push('/files')} />
        <QuickAction icon={MessageCircle} label="New chat" onClick={() => router.push('/chats')} />
        <QuickAction icon={Upload} label="Upload" onClick={() => window.dispatchEvent(new Event('app:open-file-upload'))} />
        <QuickAction icon={Zap} label="Automation" onClick={() => router.push('/automations')} />
        <QuickAction icon={Globe2} label="Create site" onClick={() => router.push('/hosting')} />
        <QuickAction icon={TerminalSquare} label="Terminal" onClick={() => router.push('/terminal')} />
      </div>

      {/* Dashboard Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Disk Usage */}
        <DashboardCard title="Storage" icon={HardDrive}>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold text-foreground">0 B</span>
              <span className="text-xs text-muted-foreground">of 10 GB</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div className="h-1.5 rounded-full bg-blue-500" style={{ width: '0%' }} />
            </div>
          </div>
        </DashboardCard>

        {/* Active Model */}
        <DashboardCard title="Active Model" icon={Sparkles}>
          <div className="flex items-center gap-2">
            <StatusBadge variant="success" dot>{process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'MiniMax-M2.7'}</StatusBadge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Configured via NEXT_PUBLIC_DEFAULT_MODEL. Manage providers in Settings.
          </p>
        </DashboardCard>

        {/* Recent Files */}
        <DashboardCard title="Recent Files" icon={FileText}>
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">No files yet</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => router.push('/files')}>
              <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
              Open Files
            </Button>
          </div>
        </DashboardCard>

        {/* Recent Conversations */}
        <DashboardCard title="Recent Chats" icon={MessageCircle}>
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">No conversations yet</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => router.push('/chats')}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Chat
            </Button>
          </div>
        </DashboardCard>

        {/* Active Automations */}
        <DashboardCard title="Automations" icon={Clock3}>
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">No automations configured</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => router.push('/automations')}>
              <Zap className="mr-1.5 h-3.5 w-3.5" />
              Create Automation
            </Button>
          </div>
        </DashboardCard>

        {/* Running Services */}
        <DashboardCard title="Hosted Services" icon={Globe2}>
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">No services running</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => router.push('/hosting')}>
              <Globe2 className="mr-1.5 h-3.5 w-3.5" />
              Create Site
            </Button>
          </div>
        </DashboardCard>
      </div>
    </div>
  );
}
