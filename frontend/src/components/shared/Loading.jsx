import { useTheme } from "@/components/shared/ThemeProvider";

const LoadingScreen = () => {
  const { theme } = useTheme();

  return (
    <div className="flex items-center justify-center h-screen bg-white dark:bg-zinc-900">
      <div
        className={`w-10 h-10 border-4 rounded-full animate-spin ${
          theme === "dark"
            ? "border-gray-300 border-t-transparent"
            : "border-blue-500 border-t-transparent"
        }`}
      ></div>
    </div>
  );
};

export default LoadingScreen;
