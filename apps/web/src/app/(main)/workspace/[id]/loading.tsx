import { Loader2 } from 'lucide-react';

export default function WorkspaceLoading() {
  return (
    <div className="flex h-full w-full flex-col bg-background">
      <header className="flex h-10 items-center justify-between border-b border-border bg-card px-4 shadow-sm">
        <div className="h-4 w-48 animate-pulse rounded bg-muted"></div>
      </header>
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center text-muted-foreground">
          <Loader2 className="h-8 w-8 mb-4 motion-safe:animate-spin opacity-50" />
          <p className="text-sm font-medium animate-pulse">Loading workspace environment...</p>
        </div>
      </div>
    </div>
  );
}
