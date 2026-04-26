'use client';

import { Camera, Download, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function SnapshotsPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Snapshots</h2>
          <p className="text-sm text-muted-foreground">Backup and restore your workspace</p>
        </div>
        <Button size="sm">
          <Camera className="mr-1.5 h-3.5 w-3.5" />
          Create Snapshot
        </Button>
      </div>

      <div className="mt-6">
        <EmptyState
          icon={<Camera className="h-6 w-6" />}
          title="No snapshots yet"
          description="Create a snapshot to backup your current workspace state. You can restore it anytime."
          action={{
            label: 'Create first snapshot',
            onClick: () => {},
          }}
        />
      </div>
    </div>
  );
}
