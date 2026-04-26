'use client';

import { useMemo, useState } from 'react';
import type React from 'react';
import { Bot, Search, Sparkles, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Skill = {
  id: string;
  name: string;
  description: string;
  installed: boolean;
  tags: string[];
};

const skills: Skill[] = [
  {
    id: 'research-topic',
    name: 'research-topic',
    description: 'Research a topic comprehensively and write a structured report.',
    installed: true,
    tags: ['Research', 'Automation', 'Workspace'],
  },
  {
    id: 'code-review',
    name: 'code-review',
    description: 'Inspect workspace changes and summarize risks, regressions, and missing tests.',
    installed: true,
    tags: ['Code', 'Quality', 'Agent'],
  },
  {
    id: 'site-publisher',
    name: 'site-publisher',
    description: 'Prepare a workspace app for publishing and deployment checks.',
    installed: false,
    tags: ['Hosting', 'Deploy', 'Automation'],
  },
  {
    id: 'dataset-cleaner',
    name: 'dataset-cleaner',
    description: 'Normalize CSV or JSON datasets and produce a concise data quality report.',
    installed: false,
    tags: ['Data', 'Files', 'Automation'],
  },
];

export default function SkillsPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'installed' | 'recommended'>('all');

  const filteredSkills = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return skills.filter((skill) => {
      const matchesQuery =
        !normalizedQuery ||
        skill.name.toLowerCase().includes(normalizedQuery) ||
        skill.description.toLowerCase().includes(normalizedQuery) ||
        skill.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));
      const matchesFilter =
        filter === 'all' || (filter === 'installed' && skill.installed) || (filter === 'recommended' && !skill.installed);
      return matchesQuery && matchesFilter;
    });
  }, [filter, query]);

  return (
    <div className="flex-1 overflow-auto p-6 lg:p-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Skills</h1>
          <p className="mt-2 max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
            Installed and recommended capabilities for workspace automation.
          </p>
        </div>
        <Button variant="outline" disabled>
          <Wrench className="mr-1 h-4 w-4" />
          Open folder
        </Button>
      </header>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative md:w-96">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search skills..." className="pl-9" />
        </div>
        <div className="flex rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
            All
          </FilterButton>
          <FilterButton active={filter === 'installed'} onClick={() => setFilter('installed')}>
            Installed
          </FilterButton>
          <FilterButton active={filter === 'recommended'} onClick={() => setFilter('recommended')}>
            Hub
          </FilterButton>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filteredSkills.map((skill) => (
          <article key={skill.id} className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {skill.installed ? <Bot className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{skill.name}</h2>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{skill.description}</p>
                </div>
              </div>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {skill.installed ? 'Installed' : 'Hub'}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {skill.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {tag}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-7 rounded-md px-3 text-sm font-medium transition-colors ${
        active
          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
      }`}
    >
      {children}
    </button>
  );
}
