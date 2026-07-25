import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/dashboard/Sidebar";

export default function Dashboard() {
  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950 dark:text-white text-black">
      <Sidebar />
      <main className="flex-1 p-6 md:p-10 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
