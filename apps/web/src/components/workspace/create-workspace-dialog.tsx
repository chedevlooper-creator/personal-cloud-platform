'use client';

import { useState } from 'react';
import type React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage, workspaceApi } from '@/lib/api';

export type WorkspaceSummary = {
  id: string;
  name: string;
  storageUsed: number;
  storageLimit: number;
  createdAt: string;
  updatedAt: string;
};

type CreateWorkspaceDialogProps = {
  trigger?: React.ReactElement;
  redirectOnCreate?: boolean;
};

export function CreateWorkspaceDialog({ trigger, redirectOnCreate = true }: CreateWorkspaceDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('My Workspace');
  const router = useRouter();
  const queryClient = useQueryClient();

  const createWorkspace = useMutation({
    mutationFn: async () => {
      const res = await workspaceApi.post('/workspaces', { name: name.trim() });
      return res.data as WorkspaceSummary;
    },
    onSuccess: (workspace) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('Workspace created.');
      setOpen(false);
      setName('My Workspace');
      if (redirectOnCreate) {
        router.push(`/workspace/${workspace.id}`);
      }
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Could not create workspace.'));
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    createWorkspace.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger || (
            <Button>
              <Plus data-icon="inline-start" />
              New Workspace
            </Button>
          )
        }
      />
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
            <DialogDescription>Start with README and sample source files.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Name</Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="My Workspace"
              autoFocus
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={!name.trim() || createWorkspace.isPending}>
              {createWorkspace.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
