import { create } from 'zustand';

interface WorkspaceState {
  currentWorkspaceId: string | null;
  setCurrentWorkspaceId: (id: string | null) => void;
  selectedFile: string | null;
  setSelectedFile: (path: string | null) => void;
  openFiles: string[];
  setOpenFiles: (files: string[]) => void;
  addOpenFile: (path: string) => void;
  removeOpenFile: (path: string) => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  currentWorkspaceId: null,
  setCurrentWorkspaceId: (id) => set({ currentWorkspaceId: id }),
  selectedFile: null,
  setSelectedFile: (path) => set({ selectedFile: path }),
  openFiles: [],
  setOpenFiles: (files) => set({ openFiles: files }),
  addOpenFile: (path) => set((state) => ({ 
    openFiles: state.openFiles.includes(path) ? state.openFiles : [...state.openFiles, path] 
  })),
  removeOpenFile: (path) => set((state) => ({
    openFiles: state.openFiles.filter(f => f !== path),
    selectedFile: state.selectedFile === path ? null : state.selectedFile
  })),
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
}));
