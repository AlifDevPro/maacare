import type { DocsSectionRow } from "./types";

export type DocsSectionRenderer = {
  key: string;
  title: string;
  description: string;
};

const DEFAULT_REGISTRY: Record<string, DocsSectionRenderer> = {
  pitch: {
    key: "pitch",
    title: "YC Pitch",
    description: "Business and narrative deck sections.",
  },
  technical: {
    key: "technical",
    title: "Technical",
    description: "Engineering design and implementation details.",
  },
  architecture: {
    key: "architecture",
    title: "Architecture",
    description: "System diagrams and infrastructure details.",
  },
  data_flow: {
    key: "data_flow",
    title: "Data Flow",
    description: "Data movement, transformations, and dependencies.",
  },
  live_matrix: {
    key: "live_matrix",
    title: "Live Matrix",
    description: "Operational status and real-time indicators.",
  },
  team: {
    key: "team",
    title: "Team",
    description: "Maintainer and contributor profiles.",
  },
  changelog: {
    key: "changelog",
    title: "Changelog",
    description: "Publish history and notable updates.",
  },
  custom: {
    key: "custom",
    title: "Custom",
    description: "Extensible fallback for new section types.",
  },
};

export function getDocsSectionRegistry() {
  return DEFAULT_REGISTRY;
}

export function resolveSectionRenderer(section: DocsSectionRow) {
  const registry = getDocsSectionRegistry();
  return registry[section.section_type] ?? registry.custom;
}

