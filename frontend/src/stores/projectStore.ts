import { create } from 'zustand';
import type { Project, PaginatedResponse } from '@/types';
import { projectAPI } from '@/api/endpoints';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  total: number;
  isLoading: boolean;
  filters: Record<string, string>;
  setFilters: (filters: Record<string, string>) => void;
  fetchProjects: (params?: Record<string, string>) => Promise<void>;
  fetchProject: (id: string) => Promise<void>;
  createProject: (data: Record<string, unknown>) => Promise<Project>;
  updateProject: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  total: 0,
  isLoading: false,
  filters: {},

  setFilters: (filters) => set({ filters }),

  fetchProjects: async (params) => {
    set({ isLoading: true });
    try {
      const mergedParams = { ...get().filters, ...params };
      const res = await projectAPI.list(mergedParams);
      const data = res.data as PaginatedResponse<Project>;
      set({ projects: data.results, total: data.count, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchProject: async (id) => {
    set({ isLoading: true });
    try {
      const res = await projectAPI.get(id);
      set({ currentProject: res.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createProject: async (data) => {
    const res = await projectAPI.create(data);
    await get().fetchProjects();
    return res.data;
  },

  updateProject: async (id, data) => {
    await projectAPI.update(id, data);
    await get().fetchProject(id);
    await get().fetchProjects();
  },

  deleteProject: async (id) => {
    await projectAPI.delete(id);
    await get().fetchProjects();
  },
}));
