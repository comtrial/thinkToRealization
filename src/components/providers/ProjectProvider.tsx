"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface Project {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  projectDir: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProjectContextValue {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  projects: Project[];
  loading: boolean;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue>({
  currentProject: null,
  setCurrentProject: () => {},
  projects: [],
  loading: true,
  refreshProjects: async () => {},
});

export function useProject() {
  return useContext(ProjectContext);
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/projects", { cache: 'no-store' });
      if (!res.ok) {
        console.error(`Projects API failed: ${res.status}`);
        return;
      }
      const json = await res.json();
      const list: Project[] = json.data ?? [];
      setProjects(list);

      // Auto-select first project if none selected or current was removed
      if (list.length > 0) {
        setCurrentProject((prev) => {
          if (prev && list.some((p) => p.id === prev.id)) return prev;
          return list[0];
        });
      } else {
        setCurrentProject(null);
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  return (
    <ProjectContext.Provider
      value={{ currentProject, setCurrentProject, projects, loading, refreshProjects }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
