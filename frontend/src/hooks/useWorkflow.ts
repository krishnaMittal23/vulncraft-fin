import { BACKEND_URL } from "@/lib/constant";
import { authHeaders, authFetch } from "@/lib/api";
import type { Workflow } from "@/types/workflow";

const API_URL = `${BACKEND_URL}/api/workflows`;

export const workflowApi = {
  getAllWorkflows: async (): Promise<Workflow[]> => {
    try {
      const response = await authFetch(API_URL);
      if (!response.ok) throw new Error("Failed to fetch workflows");
      const data = await response.json();
      return data.workflows || data;
    } catch (error) {
      console.error("Error fetching workflows:", error);
      throw error;
    }
  },

  getWorkflowById: async (id: string): Promise<Workflow> => {
    try {
      const response = await authFetch(`${API_URL}/${id}`);
      if (!response.ok) throw new Error("Failed to fetch workflow");
      const data = await response.json();
      return data.workflow || data;
    } catch (error) {
      console.error(`Error fetching workflow ${id}:`, error);
      throw error;
    }
  },

  createWorkflow: async (workflow: Workflow): Promise<Workflow> => {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(workflow),
      });
      if (!response.ok) throw new Error("Failed to create workflow");
      const data = await response.json();
      return data.workflow || data;
    } catch (error) {
      console.error("Error creating workflow:", error);
      throw error;
    }
  },

  updateWorkflow: async (
    workflow: Workflow
  ): Promise<Workflow> => {
    try {
      // Use _id if available (from MongoDB), otherwise use id
      const workflowId = workflow._id || workflow.id;

      if (!workflowId) {
        throw new Error("Workflow ID is missing");
      }

      const response = await fetch(`${API_URL}/${workflowId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(workflow),
      });
      if (!response.ok) throw new Error("Failed to update workflow");
      const data = await response.json();
      return data.workflow || data;
    } catch (error) {
      console.error(`Error updating workflow:`, error);
      throw error;
    }
  },

  deleteWorkflow: async (id: string): Promise<void> => {
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
        headers: { ...authHeaders() },
      });
      if (!response.ok) throw new Error("Failed to delete workflow");
    } catch (error) {
      console.error(`Error deleting workflow ${id}:`, error);
      throw error;
    }
  },
};
