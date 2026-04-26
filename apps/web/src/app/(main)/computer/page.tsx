import { Layers3 } from 'lucide-react';
import { ModulePlaceholder } from '@/components/app-shell/module-placeholder';

export default function ComputerPage() {
  return (
    <ModulePlaceholder
      icon={Layers3}
      title="Computer"
      description="Interactive computer sessions will be connected here once runtime streaming is promoted to the app shell."
    />
  );
}
