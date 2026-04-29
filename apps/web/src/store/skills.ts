import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ActiveSkillsState {
  activeSkillIds: string[];
  toggleSkill: (id: string) => void;
  setActiveSkills: (ids: string[]) => void;
  clear: () => void;
}

export const useActiveSkillsStore = create<ActiveSkillsState>()(
  persist(
    (set, get) => ({
      activeSkillIds: [],
      toggleSkill: (id) => {
        const current = get().activeSkillIds;
        if (current.includes(id)) {
          set({ activeSkillIds: current.filter((s) => s !== id) });
        } else if (current.length < 5) {
          set({ activeSkillIds: [...current, id] });
        }
      },
      setActiveSkills: (ids) => set({ activeSkillIds: ids.slice(0, 5) }),
      clear: () => set({ activeSkillIds: [] }),
    }),
    { name: 'cloudmind-active-skills' },
  ),
);
