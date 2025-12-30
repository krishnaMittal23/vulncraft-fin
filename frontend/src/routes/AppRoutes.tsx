import { Routes, Route, Navigate } from "react-router-dom";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Workflow from "@/components/dashboard/Workflow";
import Report from "@/components/dashboard/Report";
import MonitoredRepos from "@/components/dashboard/MonitoredRepos";
import Repository from "@/components/dashboard/Repository";
import PrivateRoute from "@/components/auth/PrivateRoute";
import WorkflowBuilder from "@/pages/Workflowbuilder";
import LLMTester from "@/pages/LLMTester";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Auth />} />
      <Route path="/llm-test" element={<LLMTester />} />
      <Route element={<PrivateRoute />}>
        <Route path="/dashboard/*" element={<Dashboard />}>
          <Route index element={<Workflow />} />
          <Route path="workflow" element={<Workflow />} />
          <Route path="report" element={<Report />} />
          <Route path="monitored" element={<MonitoredRepos />} />
          <Route path="repository" element={<Repository />} />
        </Route>
        <Route path="/workflow/:id" element={<WorkflowBuilder />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default AppRoutes;
