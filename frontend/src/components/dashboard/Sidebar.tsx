import { useEffect, useState } from "react";
import {
  LogOut,
  Menu,
  Workflow,
  FileText,
  Shield,
  Github,
  Settings,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";
import VulnCraftLogo from "../shared/Logo";
import useAuth from "@/hooks/useAuth";

const mono = { fontFamily: "'JetBrains Mono',monospace" } as const;

const navItems = [
  { icon: Workflow, label: "Workflow", display: "Workflows" },
  { icon: FileText, label: "Report", display: "Security Reports" },
  { icon: Shield, label: "Monitored", display: "Monitored" },
  { icon: Github, label: "Repository", display: "Repositories" },
  { icon: Settings, label: "Settings", display: "Settings" },
] as const;

export function Sidebar() {
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState("workflow");
  const { user, logout } = useAuth();

  useEffect(() => {
    if (window.location.pathname === "/dashboard") {
      navigate("/dashboard/workflow", { replace: true });
    }
  }, [navigate]);

  const handleItemClick = (item: string) => {
    navigate(`/dashboard/${item}`);
    setActiveItem(item);
  };

  const SidebarContent = () => (
    <div
      className="flex h-full flex-col bg-[#09090b] text-[#e5e1e4] border-r border-[#27272a]/50"
      style={{ fontFamily: "'Geist',sans-serif" }}
    >
      {/* Logo */}
      <div className="px-6 py-7">
        <div className="flex items-center gap-3">
          <VulnCraftLogo className="h-10 w-10" />
          <div className="leading-tight">
            <h1 className="text-xl font-bold tracking-tight text-[#4be277]">
              VulnCraft
            </h1>
            <p
              className="text-[10px] uppercase tracking-[0.18em] text-[#bccbb9]/60"
              style={mono}
            >
              DevSecOps Console
            </p>
          </div>
        </div>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 space-y-1 px-4">
        {navItems.map(({ icon: Icon, label, display }) => {
          const isActive = activeItem === label.toLowerCase();
          return (
            <button
              key={label}
              onClick={() => handleItemClick(label.toLowerCase())}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-all duration-150 ${
                isActive
                  ? "bg-[#4be277]/10 border-r-2 border-[#4be277] font-semibold text-[#4be277]"
                  : "text-[#bccbb9] hover:bg-[#18181b] hover:text-[#e5e1e4]"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-sm">{display}</span>
            </button>
          );
        })}
      </nav>

      {/* User block + logout */}
      <div className="mt-auto border-t border-[#27272a]/50 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-[#131315] p-3">
          <Avatar className="h-10 w-10 border border-[#27272a]">
            <AvatarImage src={`${user?.avatar}`} alt="User" />
            <AvatarFallback className="bg-[#18181b] text-[#4be277]">
              {user?.username?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#e5e1e4]">
              {user?.username}
            </p>
            <p className="truncate text-xs text-[#bccbb9]/70" style={mono}>
              {user?.email}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            aria-label="Logout"
            className="h-8 w-8 shrink-0 text-[#bccbb9] hover:bg-[#18181b] hover:text-[#4be277]"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden md:flex md:w-72 md:flex-col">
        <SidebarContent />
      </div>

      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed right-4 top-4 z-40 border-[#27272a] bg-[#131315] text-[#e5e1e4] md:hidden"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-72 border-r border-[#27272a]/50 bg-[#09090b] p-0"
        >
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
}
export default Sidebar;
