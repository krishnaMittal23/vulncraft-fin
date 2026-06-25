import { Routes, Route, Navigate } from "react-router-dom";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Workflow from "@/components/dashboard/Workflow";
import Report from "@/components/dashboard/Report";
import ReportDetail from "@/components/dashboard/ReportDetail";
import MonitoredRepos from "@/components/dashboard/MonitoredRepos";
import Repository from "@/components/dashboard/Repository";
import Settings from "@/components/dashboard/Settings";
import PrivateRoute from "@/components/auth/PrivateRoute";
import WorkflowBuilder from "@/pages/Workflowbuilder";
import RunDetail from "@/pages/RunDetail";
import LLMTester from "@/pages/LLMTester";
import AuthCallback from "@/pages/AuthCallback";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Auth />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route element={<PrivateRoute />}>
        <Route path="/llm-test" element={<LLMTester />} />
        <Route path="/dashboard/*" element={<Dashboard />}>
          <Route index element={<Workflow />} />
          <Route path="workflow" element={<Workflow />} />
          <Route path="report" element={<Report />} />
          <Route path="report/:id" element={<ReportDetail />} />
          <Route path="monitored" element={<MonitoredRepos />} />
          <Route path="repository" element={<Repository />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="/workflow/:id" element={<WorkflowBuilder />} />
        <Route path="/run/:id" element={<RunDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default AppRoutes;
