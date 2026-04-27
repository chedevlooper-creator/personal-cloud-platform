import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PersonaState {
  activePersonaId: string | null;
  activePersonaName: string | null;
  setActivePersona: (id: string | null, name: string | null) => void;
}

export const usePersonaStore = create<PersonaState>()(
  persist(
    (set) => ({
      activePersonaId: null,
      activePersonaName: null,
      setActivePersona: (id, name) => set({ activePersonaId: id, activePersonaName: name }),
    }),
    { name: 'cloudmind-persona' },
  ),
);
