"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

interface Project {
  id: string;
  name: string;
  slug: string;
}

interface ProjectContextValue {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
}

const ProjectContext = createContext<ProjectContextValue>({
  currentProject: null,
  setCurrentProject: () => {},
});

export function useProject() {
  return useContext(ProjectContext);
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  return (
    <ProjectContext.Provider value={{ currentProject, setCurrentProject }}>
      {children}
    </ProjectContext.Provider>
  );
}
