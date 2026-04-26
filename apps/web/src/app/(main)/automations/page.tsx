'use client';

import { useState } from 'react';
import {
  Clock3,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Trash2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

type Tab = 'active' | 'paused' | 'history';

const tabs: { id: Tab; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'history', label: 'History' },
];

export default function AutomationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('active');

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Automations</h2>
          <p className="text-sm text-muted-foreground">Schedule AI tasks to run automatically</p>
        </div>
        <Button size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Create Automation
        </Button>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-6">
        <EmptyState
          icon={<Clock3 className="h-6 w-6" />}
          title={`No ${activeTab} automations`}
          description="Create an automation to schedule AI tasks like file processing, reports, or backups."
          action={{
            label: 'Create automation',
            onClick: () => {},
          }}
        />
      </div>
    </div>
  );
}
