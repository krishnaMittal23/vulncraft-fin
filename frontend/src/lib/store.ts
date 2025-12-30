import { create } from "zustand";
import type { DataSource, Workflow } from "@/types/workflow";
import { workflowApi } from "@/hooks/useWorkflow";
import { toast } from "sonner";

interface WorkflowStore {
  workflows: Workflow[];
  isLoading: boolean;
  error: string | null;
  activeWorkflowId: string | null;
  activeDataSource: DataSource | null;

  // Actions
  fetchWorkflows: () => Promise<void>;
  fetchWorkflowById: (id: string) => Promise<Workflow | null>;
  addWorkflow: (workflow: Workflow) => Promise<Workflow>;
  updateWorkflow: (workflow: Workflow, username?: string) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  setActiveWorkflow: (id: string | null) => void;
  setActiveDataSource: (dataSource: DataSource | null) => void;
}

export const useWorkflowStore = create<WorkflowStore>()((set) => ({
  workflows: [],
  isLoading: false,
  error: null,
  activeWorkflowId: null,
  activeDataSource: null,

  fetchWorkflows: async () => {
    set({ isLoading: true, error: null });
    try {
      const workflows = await workflowApi.getAllWorkflows();
      // Normalize all workflows to have an id field
      const normalizedWorkflows = workflows.map(w => ({
        ...w,
        id: w._id || w.id
      }));
      set({ workflows: normalizedWorkflows, isLoading: false });
    } catch (error) {
      console.error("Failed to fetch workflows:", error);
      set({
        error: "Failed to load workflows. Please try again.",
        isLoading: false,
      });
      toast.error("Failed to load workflows");
    }
  },

  fetchWorkflowById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const workflow = await workflowApi.getWorkflowById(id);
      // Normalize the workflow to always have an id field
      const normalizedWorkflow = {
        ...workflow,
        id: workflow._id || workflow.id
      };
      // Update the workflow in the store if it exists
      set((state) => ({
        workflows: state.workflows.map((w) =>
          (w.id === normalizedWorkflow.id || w._id === normalizedWorkflow._id) ? normalizedWorkflow : w
        ),
        isLoading: false,
      }));
      return normalizedWorkflow;
    } catch (error) {
      console.error(`Failed to fetch workflow ${id}:`, error);
      set({
        error: `Failed to load workflow. Please try again.`,
        isLoading: false,
      });
      toast.error("Failed to load workflow");
      return null;
    }
  },

  addWorkflow: async (workflow: Workflow) => {
    set({ isLoading: true, error: null });
    try {
      const newWorkflow = await workflowApi.createWorkflow(workflow);
      // Normalize the workflow to always have an id field
      const normalizedWorkflow = {
        ...newWorkflow,
        id: newWorkflow._id || newWorkflow.id
      };
      set((state) => ({
        workflows: [...state.workflows, normalizedWorkflow],
        isLoading: false,
      }));
      return normalizedWorkflow;
    } catch (error) {
      console.error("Failed to create workflow:", error);
      set({
        error: "Failed to create workflow. Please try again.",
        isLoading: false,
      });
      toast.error("Failed to create workflow");
      throw error;
    }
  },

  updateWorkflow: async (workflow: Workflow, username?: string) => {
    if (!username) {
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const updatedWorkflow = await workflowApi.updateWorkflow(workflow);
      // Normalize the workflow to always have an id field
      const normalizedWorkflow = {
        ...updatedWorkflow,
        id: updatedWorkflow._id || updatedWorkflow.id
      };
      set((state) => ({
        workflows: state.workflows.map((w) =>
          (w.id === normalizedWorkflow.id || w._id === normalizedWorkflow._id) ? normalizedWorkflow : w
        ),
        isLoading: false,
      }));
    } catch (error) {
      console.error(`Failed to update workflow:`, error);
      set({
        error: "Failed to update workflow. Please try again.",
        isLoading: false,
      });
      toast.error("Failed to update workflow");
      throw error;
    }
  },

  deleteWorkflow: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await workflowApi.deleteWorkflow(id);
      set((state) => ({
        workflows: state.workflows.filter((w) => w.id !== id),
        activeWorkflowId:
          state.activeWorkflowId === id ? null : state.activeWorkflowId,
        isLoading: false,
      }));
    } catch (error) {
      console.error(`Failed to delete workflow ${id}:`, error);
      set({
        error: "Failed to delete workflow. Please try again.",
        isLoading: false,
      });
      toast.error("Failed to delete workflow");
      throw error;
    }
  },

  setActiveWorkflow: (id) => set({ activeWorkflowId: id }),

  setActiveDataSource: (dataSource) => set({ activeDataSource: dataSource }),
}));
