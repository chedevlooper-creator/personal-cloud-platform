import { Bookmark } from 'lucide-react';
import { ModulePlaceholder } from '@/components/app-shell/module-placeholder';

export default function BookmarksPage() {
  return (
    <ModulePlaceholder
      icon={Bookmark}
      title="Bookmarks"
      description="Saved workspaces, files, apps, and command shortcuts will be collected here."
    />
  );
}
