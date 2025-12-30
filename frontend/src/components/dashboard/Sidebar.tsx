import { useEffect, useState } from "react";
import {
  LogOut,
  MoreVertical,
  Menu,
  Workflow,
  FileText,
  Shield,
  Github,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import VulnCraftLogo from "../shared/Logo";
import useAuth from "@/hooks/useAuth";

export function Sidebar() {
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState("workflow");
  const { user } = useAuth();

  useEffect(() => {
    if (window.location.pathname === "/dashboard") {
      navigate("/dashboard/workflow", { replace: true });
    }
  }, [navigate]);

  const handleItemClick = (item: string) => {
    navigate(`/dashboard/${item}`);
    setActiveItem(item);
  };

  const { logout } = useAuth();

  const SidebarContent = () => (
    <div
      className={`flex flex-col h-full dark:bg-zinc-950 bg-white transition-colors duration-200`}
    >
      <div className="p-6">
        <div className="flex items-center space-x-2 cursor-pointer hover:scale-105 transition-transform duration-300 ease-in-out">
          <VulnCraftLogo className="h-10 w-10" />
          <h1 className="text-transparent bg-clip-text bg-white font-bold text-xl">
            VulnCraft
          </h1>
        </div>
      </div>

      <div className="flex-1 px-4">
        <nav className="space-y-1">
          {[
            { icon: Workflow, label: "Workflow" },
            { icon: FileText, label: "Report" },
            { icon: Shield, label: "Monitored" },
            { icon: Github, label: "Repository" },
          ].map(({ icon: Icon, label }) => (
            <Button
              key={label}
              variant="ghost"
              className={`w-full justify-start ${
                activeItem === label.toLowerCase()
                  ? `hover:bg-blue-400`
                  : `hover:bg-blue-50 dark:hover:bg-zinc-950`
              }  transition-colors duration-200 text-black dark:text-white
                ${
                  activeItem === label.toLowerCase()
                    ? "bg-blue-500 text-white"
                    : ""
                }`}
              onClick={() => handleItemClick(label.toLowerCase())}
            >
              <Icon className="mr-3 h-4 w-4" />
              <span className="font-medium">{label}</span>
            </Button>
          ))}
        </nav>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={`${user?.avatar}`} alt="User" />
              <AvatarFallback className="bg-blue-100 text-blue-600">
                {user?.username.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-semibold text-black dark:text-white">
                {user?.username}
              </p>
              <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4 dark:text-white" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start hover:bg-blue-50 dark:hover:bg-blue-950 text-red-500"
                  onClick={logout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            </PopoverContent>
          </Popover>
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
            className="md:hidden fixed top-4 right-4 z-40 text-black dark:text-white"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
}
export default Sidebar;
