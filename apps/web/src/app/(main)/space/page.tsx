import { Boxes } from 'lucide-react';
import { ModulePlaceholder } from '@/components/app-shell/module-placeholder';

export default function SpacePage() {
  return (
    <ModulePlaceholder
      icon={Boxes}
      title="Space"
      description="Space-level identity, members, and shared resources will live in this surface."
    />
  );
}
