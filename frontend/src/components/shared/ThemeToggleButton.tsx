import { useTheme } from "@/components/shared/ThemeProvider";
import { Moon, Sun } from "lucide-react";

const ThemeToggleButton = () => {
  const { theme, setTheme } = useTheme();

  return (
    <button
      className="absolute top-4 right-4 p-2 rounded-full bg-accent transition"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5 text-white" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
};

export default ThemeToggleButton;
