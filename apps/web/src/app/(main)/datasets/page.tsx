import { Database } from 'lucide-react';
import { ModulePlaceholder } from '@/components/app-shell/module-placeholder';

export default function DatasetsPage() {
  return (
    <ModulePlaceholder
      icon={Database}
      title="Datasets Beta"
      description="Dataset storage, preview, and cleaning workflows are marked beta and not wired to a backend registry yet."
    />
  );
}
