import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Github, CloudUpload, Layout, Settings, Bug } from "lucide-react";
import VulnCraftLogo from "../shared/Logo";
import useAuth from "@/hooks/useAuth";

const RightSection = () => {
  const { loginWithGithub } = useAuth();

  return (
    <div className="w-full max-w-7xl mx-auto px-8 py-16 flex flex-col lg:flex-row items-start justify-between gap-24">
      {/* Left Side - Hero Content */}
      <div className="flex-1 max-w-2xl">
        <div className="flex items-center gap-5 mb-12">
          <div className="relative">
            <VulnCraftLogo className="h-20 w-20 relative z-10" />
            <div className="absolute inset-0 bg-white/15 blur-xl rounded-full" />
          </div>
          <div>
            <h1 className="text-6xl font-extrabold bg-gradient-to-r from-white via-gray-200 to-zinc-300 bg-clip-text text-transparent leading-tight">
              VulnCraft
            </h1>
            <p className="text-gray-400 text-base font-mono mt-1 tracking-wide">
              Enterprise Security Suite
            </p>
          </div>
        </div>

        <h2 className="text-4xl font-extrabold text-white mb-8 leading-snug">
          Automated Security Testing & <br />
          <span className="bg-linear-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Vulnerability Management
          </span>
        </h2>

        <p className="text-gray-300 text-lg mb-14 leading-relaxed max-w-xl tracking-wide">
          Protect your codebase with AI-powered security analysis, automated vulnerability scanning, and seamless CI/CD pipeline integration. Design custom drag-and-drop security workflows, configure multiple DAST and SAST tools, and receive real-time alerts to keep your software safe.
        </p>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl">
          {[
            { icon: CloudUpload, text: "CI/CD Security Integration" },
            { icon: Layout, text: "Drag-and-Drop Security Workflow" },
            { icon: Settings, text: "Configurable Security Tools" },
            { icon: Bug, text: "DAST & SAST Scans" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-4 text-white bg-zinc-900/50 backdrop-blur-sm border border-zinc-700/50 rounded-lg p-5 hover:border-zinc-500/70 hover:bg-zinc-900/70 transition-all">
              <Icon className="h-6 w-6 text-white flex-shrink-0" />
              <span className="text-base font-semibold tracking-wide">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Side - Auth Card */}
      <div className="w-full lg:w-[480px] pt-20">
        <Card className="shadow-2xl bg-zinc-900/90 backdrop-blur-xl border border-zinc-700/50 overflow-hidden">
          {/* Animated top border */}
          <div className="h-1 bg-linear-to-r from-white via-gray-300 to-zinc-400 animate-shimmer" />

          <CardHeader className="pb-4 pt-8 px-8">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="p-3 rounded-full bg-white/10 border border-zinc-600/50">
                <Github className="h-6 w-6 text-white" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-2 tracking-wide">
              Secure Access Portal
            </h3>
            <p className="text-gray-300 text-sm text-center leading-relaxed max-w-xs mx-auto tracking-wide">
              Connect your GitHub account to enable CI/CD integrated security analysis and automated vulnerability detection.
            </p>
          </CardHeader>

          <CardContent className="space-y-4 pb-8 px-8">
            <Button
              className="w-full h-12 bg-gradient-to-r from-zinc-700 to-zinc-800 hover:from-zinc-600 hover:to-zinc-700 text-white font-semibold flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-white/20 relative overflow-hidden group"
              onClick={loginWithGithub}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white to-gray-300 opacity-0 group-hover:opacity-15 transition-opacity" />
              <Github className="h-5 w-5 relative z-10" />
              <span className="relative z-10 tracking-wide text-base">Authenticate with GitHub</span>
            </Button>
          </CardContent>
        </Card>

        {/* Trust Indicators */}
        <div className="mt-10 flex items-center justify-center gap-3 text-xs text-gray-500 tracking-wide">
          <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
          <span>All Systems Operational</span>
        </div>
      </div>
    </div>
  );
};

export default RightSection;
