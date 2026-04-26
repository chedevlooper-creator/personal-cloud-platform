import { TerminalSquare } from 'lucide-react';
import { ModulePlaceholder } from '@/components/app-shell/module-placeholder';

export default function TerminalPage() {
  return (
    <ModulePlaceholder
      icon={TerminalSquare}
      title="Terminal"
      description="Open a workspace to use the live terminal panel with runtime context."
      actionLabel="Open workspace"
    />
  );
}
