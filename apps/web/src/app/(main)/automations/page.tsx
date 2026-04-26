import { Clock3 } from 'lucide-react';
import { ModulePlaceholder } from '@/components/app-shell/module-placeholder';

export default function AutomationsPage() {
  return (
    <ModulePlaceholder
      icon={Clock3}
      title="Automations"
      description="Scheduled and event-driven workspace automations are reserved for the next workflow layer."
      actionLabel="Create automation"
    />
  );
}
