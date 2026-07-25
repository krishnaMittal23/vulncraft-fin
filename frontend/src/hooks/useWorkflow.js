import { BACKEND_URL } from "@/lib/constant";
import { authHeaders, authFetch } from "@/lib/api";
const API_URL = `${BACKEND_URL}/api/workflows`;

export const workflowApi = {
  getAllWorkflows: async () => {
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

  getWorkflowById: async (id) => {
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

  createWorkflow: async (workflow) => {
    try {
      const response = await fetch(API_URL, {
        method: "POST", headers: { ...authHeaders() },
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

  updateWorkflow: async (workflow) => {
    try {
      // Use _id if available (from MongoDB), otherwise use id
      const workflowId = workflow._id || workflow.id;

      if (!workflowId) {
        throw new Error("Workflow ID is missing");
      }

      const response = await fetch(`${API_URL}/${workflowId}`, {
        method: "PUT", headers: { ...authHeaders() },
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

  deleteWorkflow: async (id) => {
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE", headers: { ...authHeaders() },
      });
      if (!response.ok) throw new Error("Failed to delete workflow");
    } catch (error) {
      console.error(`Error deleting workflow ${id}:`, error);
      throw error;
    }
  },
};
