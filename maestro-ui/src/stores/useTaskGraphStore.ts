import { create } from 'zustand';
import { maestroClient } from '../utils/MaestroClient';
import type {
  TaskGraph,
  TaskGraphNode,
  TaskGraphEdge,
  CreateTaskGraphPayload,
  UpdateTaskGraphPayload,
} from '../app/types/maestro';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  topologicalOrder?: string[];
  parallelLayers?: string[][];
}

interface TaskGraphState {
  graphs: Record<string, TaskGraph>;
  selectedGraphId: string | null;
  loading: Record<string, boolean>;
  errors: Record<string, string>;
  validationResult: ValidationResult | null;

  // CRUD
  fetchGraphs: (projectId: string) => Promise<void>;
  fetchGraph: (graphId: string) => Promise<TaskGraph>;
  createGraph: (data: CreateTaskGraphPayload) => Promise<TaskGraph>;
  updateGraph: (graphId: string, updates: UpdateTaskGraphPayload) => Promise<TaskGraph>;
  deleteGraph: (graphId: string) => Promise<void>;

  // Graph editing (optimistic local updates, then persisted via updateGraph)
  addNode: (graphId: string, node: TaskGraphNode) => void;
  removeNode: (graphId: string, taskId: string) => void;
  addEdge: (graphId: string, edge: TaskGraphEdge) => void;
  removeEdge: (graphId: string, edgeId: string) => void;
  updateNodePosition: (graphId: string, taskId: string, position: { x: number; y: number }) => void;
  updateNodeConfig: (graphId: string, taskId: string, config: Partial<TaskGraphNode>) => void;

  // Persist current graph state to server
  saveGraph: (graphId: string) => Promise<void>;

  // Validation
  validateGraph: (graphId: string) => Promise<ValidationResult>;

  // Selection
  selectGraph: (graphId: string | null) => void;

  // WebSocket handler
  handleWsEvent: (event: string, data: any) => void;

  // Reset
  reset: () => void;
}

export const useTaskGraphStore = create<TaskGraphState>((set, get) => ({
  graphs: {},
  selectedGraphId: null,
  loading: {},
  errors: {},
  validationResult: null,

  fetchGraphs: async (projectId) => {
    const key = `graphs:${projectId}`;
    set((prev) => ({ loading: { ...prev.loading, [key]: true } }));
    try {
      const list = await maestroClient.fetchTaskGraphs(projectId);
      const graphs: Record<string, TaskGraph> = { ...get().graphs };
      for (const g of list) {
        graphs[g.id] = g;
      }
      set({ graphs, loading: { ...get().loading, [key]: false } });
    } catch (err: any) {
      set((prev) => ({
        loading: { ...prev.loading, [key]: false },
        errors: { ...prev.errors, [key]: err.message },
      }));
    }
  },

  fetchGraph: async (graphId) => {
    const graph = await maestroClient.fetchTaskGraph(graphId);
    set((prev) => ({ graphs: { ...prev.graphs, [graph.id]: graph } }));
    return graph;
  },

  createGraph: async (data) => {
    const graph = await maestroClient.createTaskGraph(data);
    set((prev) => ({ graphs: { ...prev.graphs, [graph.id]: graph } }));
    return graph;
  },

  updateGraph: async (graphId, updates) => {
    const graph = await maestroClient.updateTaskGraph(graphId, updates);
    set((prev) => ({ graphs: { ...prev.graphs, [graph.id]: graph } }));
    return graph;
  },

  deleteGraph: async (graphId) => {
    await maestroClient.deleteTaskGraph(graphId);
    set((prev) => {
      const { [graphId]: _, ...rest } = prev.graphs;
      return {
        graphs: rest,
        selectedGraphId: prev.selectedGraphId === graphId ? null : prev.selectedGraphId,
      };
    });
  },

  // --- Local graph editing ---

  addNode: (graphId, node) => {
    set((prev) => {
      const graph = prev.graphs[graphId];
      if (!graph) return prev;
      // Prevent duplicates
      if (graph.nodes.some((n) => n.taskId === node.taskId)) return prev;
      return {
        graphs: {
          ...prev.graphs,
          [graphId]: { ...graph, nodes: [...graph.nodes, node] },
        },
      };
    });
  },

  removeNode: (graphId, taskId) => {
    set((prev) => {
      const graph = prev.graphs[graphId];
      if (!graph) return prev;
      return {
        graphs: {
          ...prev.graphs,
          [graphId]: {
            ...graph,
            nodes: graph.nodes.filter((n) => n.taskId !== taskId),
            edges: graph.edges.filter((e) => e.sourceTaskId !== taskId && e.targetTaskId !== taskId),
          },
        },
      };
    });
  },

  addEdge: (graphId, edge) => {
    set((prev) => {
      const graph = prev.graphs[graphId];
      if (!graph) return prev;
      // Prevent duplicate edges
      if (graph.edges.some((e) => e.sourceTaskId === edge.sourceTaskId && e.targetTaskId === edge.targetTaskId)) return prev;
      return {
        graphs: {
          ...prev.graphs,
          [graphId]: { ...graph, edges: [...graph.edges, edge] },
        },
      };
    });
  },

  removeEdge: (graphId, edgeId) => {
    set((prev) => {
      const graph = prev.graphs[graphId];
      if (!graph) return prev;
      return {
        graphs: {
          ...prev.graphs,
          [graphId]: { ...graph, edges: graph.edges.filter((e) => e.id !== edgeId) },
        },
      };
    });
  },

  updateNodePosition: (graphId, taskId, position) => {
    set((prev) => {
      const graph = prev.graphs[graphId];
      if (!graph) return prev;
      return {
        graphs: {
          ...prev.graphs,
          [graphId]: {
            ...graph,
            nodes: graph.nodes.map((n) => (n.taskId === taskId ? { ...n, position } : n)),
          },
        },
      };
    });
  },

  updateNodeConfig: (graphId, taskId, config) => {
    set((prev) => {
      const graph = prev.graphs[graphId];
      if (!graph) return prev;
      return {
        graphs: {
          ...prev.graphs,
          [graphId]: {
            ...graph,
            nodes: graph.nodes.map((n) => (n.taskId === taskId ? { ...n, ...config } : n)),
          },
        },
      };
    });
  },

  saveGraph: async (graphId) => {
    const graph = get().graphs[graphId];
    if (!graph) return;
    await maestroClient.updateTaskGraph(graphId, {
      nodes: graph.nodes,
      edges: graph.edges,
      name: graph.name,
      description: graph.description,
      coordinatorTeamMemberId: graph.coordinatorTeamMemberId,
      coordinatorModel: graph.coordinatorModel,
    });
  },

  validateGraph: async (graphId) => {
    const result = await maestroClient.validateTaskGraph(graphId);
    set({ validationResult: result });
    return result;
  },

  selectGraph: (graphId) => {
    set({ selectedGraphId: graphId, validationResult: null });
  },

  handleWsEvent: (event, data) => {
    switch (event) {
      case 'task_graph:created':
      case 'task_graph:updated':
        set((prev) => ({ graphs: { ...prev.graphs, [data.id]: data } }));
        break;
      case 'task_graph:deleted': {
        set((prev) => {
          const { [data.id]: _, ...rest } = prev.graphs;
          return {
            graphs: rest,
            selectedGraphId: prev.selectedGraphId === data.id ? null : prev.selectedGraphId,
          };
        });
        break;
      }
    }
  },

  reset: () => {
    set({ graphs: {}, selectedGraphId: null, loading: {}, errors: {}, validationResult: null });
  },
}));
