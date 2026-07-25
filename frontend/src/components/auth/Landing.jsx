import {
  ShieldCheck,
  Github,
  PlayCircle,
  Workflow,
  Boxes,
  BellRing,
  FileCode,
  Search,
  Activity,
  BadgeCheck,
  Send,
} from "lucide-react";
import useAuth from "@/hooks/useAuth";
import VulnCraftLogo from "@/components/shared/Logo";

const geist = { fontFamily: "'Geist', sans-serif" };
const mono = { fontFamily: "'JetBrains Mono', monospace" };

const gridBg= {
  backgroundImage:
    "linear-gradient(#18181b 1px, transparent 1px), linear-gradient(90deg, #18181b 1px, transparent 1px)",
  backgroundSize: "32px 32px",
  backgroundPosition: "center center",
};

const heroGlow= {
  background:
    "radial-gradient(circle at center, rgba(34,197,94,0.08) 0%, rgba(9,9,11,0) 70%)",
};

const nodeGlow= {
  filter: "drop-shadow(0 0 8px rgba(34,197,94,0.3))",
};

const features = [
  {
    Icon: Workflow,
    title: "Drag-and-drop workflows",
    body: "Build custom security processes visually, connecting tools seamlessly.",
    highlight: false,
  },
  {
    Icon: ShieldCheck,
    title: "SAST & DAST scanning",
    body: "Comprehensive static and dynamic analysis for vulnerabilities.",
    highlight: true,
  },
  {
    Icon: Boxes,
    title: "CI/CD integration",
    body: "Embed security testing directly into your deployment pipelines.",
    highlight: false,
  },
  {
    Icon: BellRing,
    title: "Real-time alerts",
    body: "Instant notifications for critical security issues and status changes.",
    highlight: false,
  },
];

const REPO_URL = "https://github.com/CoderFleet/vulncraft-main";

const Landing = () => {
  const { loginWithGithub } = useAuth();

  const scrollTo = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className="relative min-h-screen w-full bg-[#09090b] text-[#e5e1e4] overflow-x-hidden"
      style={geist}
    >
      {/* Background grid + hero glow */}
      <div className="fixed inset-0 pointer-events-none opacity-50" style={gridBg} />
      <div className="fixed inset-0 pointer-events-none" style={heroGlow} />

      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#09090b]/80 backdrop-blur-md border-b border-[#3d4a3d]">
        <nav className="flex justify-between items-center w-full px-6 md:px-16 max-w-[1200px] mx-auto h-20">
          <div className="flex items-center gap-2">
            <VulnCraftLogo className="h-7 w-7" />
            <span className="text-2xl font-bold tracking-tighter text-[#e5e1e4]">
              VulnCraft
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a className="text-[#bccbb9] hover:text-[#4be277] transition-colors cursor-pointer" href="#features" onClick={scrollTo("features")}>Features</a>
            <a className="text-[#bccbb9] hover:text-[#4be277] transition-colors cursor-pointer" href="#preview" onClick={scrollTo("preview")}>Live Demo</a>
            <a className="text-[#bccbb9] hover:text-[#4be277] transition-colors" href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
            <button
              onClick={loginWithGithub}
              className="flex items-center gap-2 px-5 py-2 border border-[#3d4a3d] rounded-lg hover:bg-[#201f22] transition-all text-sm font-semibold cursor-pointer"
            >
              <Github className="h-4 w-4" />
              Continue with GitHub
            </button>
          </div>
        </nav>
      </header>

      <main className="relative pt-32 pb-20">
        {/* Hero */}
        <section className="max-w-[1200px] mx-auto px-6 md:px-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#201f22] rounded-full border border-[#3d4a3d] mb-8">
            <span
              className="text-[10px] uppercase tracking-widest text-[#4be277] font-bold"
              style={mono}
            >
              // Automated Security Workflows
            </span>
          </div>
          <h1 className="text-4xl md:text-[64px] font-bold leading-[1.1] tracking-[-0.04em] max-w-4xl mx-auto mb-6">
            Ship <span className="text-[#4be277]">secure code.</span> <br />
            Automatically.
          </h1>
          <p className="text-base md:text-lg leading-relaxed text-[#bccbb9] max-w-2xl mx-auto mb-10">
            Protect your codebase with AI-powered security analysis, automated
            vulnerability scanning, and seamless CI/CD pipeline integration.
            Design custom drag-and-drop security workflows in minutes.
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-12">
            <button
              onClick={loginWithGithub}
              className="w-full md:w-auto px-8 py-4 bg-[#4be277] text-[#003915] rounded-lg font-bold hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Github className="h-5 w-5" />
              Continue with GitHub
            </button>
            <button
              onClick={scrollTo("preview")}
              className="w-full md:w-auto px-8 py-4 bg-transparent border border-[#3d4a3d] text-[#e5e1e4] rounded-lg font-semibold hover:bg-[#201f22] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlayCircle className="h-5 w-5" />
              View a live scan
            </button>
          </div>
          <div
            className="flex items-center justify-center gap-2 text-[#bccbb9] text-xs uppercase tracking-widest font-bold"
            style={mono}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4be277] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4be277]" />
            </span>
            All systems operational
          </div>
        </section>

        {/* Features */}
        <section id="features" className="max-w-[1200px] mx-auto px-6 md:px-16 mt-24 scroll-mt-24">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {features.map(({ Icon, title, body, highlight }) => (
              <div
                key={title}
                className={`p-6 rounded-xl bg-[#18181b]/60 backdrop-blur-md transition-colors group cursor-default ${
                  highlight
                    ? "border border-[#4be277]/40 bg-[#4be277]/5"
                    : "border border-[#3f3f46]/40 hover:border-[#4be277]/50"
                }`}
              >
                <Icon className="text-[#4be277] mb-4 h-6 w-6 group-hover:scale-110 transition-transform" />
                <h3 className="text-base font-bold mb-2">{title}</h3>
                <p className="text-sm text-[#bccbb9]" style={geist}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Product visual */}
        <section id="preview" className="max-w-[1200px] mx-auto px-6 md:px-16 mt-24 scroll-mt-24">
          <div className="relative rounded-2xl overflow-hidden border border-[#3d4a3d] bg-[#0e0e10] p-1">
            {/* Browser header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#131315] border-b border-[#3d4a3d]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/40" />
                <div className="w-3 h-3 rounded-full bg-zinc-500/40" />
                <div className="w-3 h-3 rounded-full bg-[#4be277]/40" />
              </div>
              <div
                className="mx-auto bg-[#1c1b1c] px-4 py-1 rounded text-[10px] text-[#bccbb9]/60 w-64 text-center"
                style={mono}
              >
                vulncraft.app/workflows/main-pipeline
              </div>
            </div>

            {/* Workflow canvas */}
            <div className="relative aspect-video md:aspect-[21/9] bg-[#0c0c0e] overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 opacity-20" style={gridBg} />
              {/* radial glows */}
              <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-32 h-32 bg-[#4be277]/10 blur-3xl rounded-full" />
              <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-32 h-32 bg-[#4be277]/10 blur-3xl rounded-full" />

              <svg className="max-w-4xl px-8" height="100%" width="100%" style={mono}>
                <defs>
                  <linearGradient id="lineGrad" x1="0%" x2="100%" y1="0%" y2="0%">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity="0.2" />
                    <stop offset="50%" stopColor="#22c55e" stopOpacity="1" />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity="0.2" />
                  </linearGradient>
                </defs>
                {/* connectors */}
                <path d="M120 150 L200 100" fill="none" stroke="#3f3f46" strokeWidth="2" />
                <path d="M120 150 L200 200" fill="none" stroke="url(#lineGrad)" strokeWidth="2" />
                <path d="M300 100 L400 150" fill="none" stroke="#3f3f46" strokeWidth="2" />
                <path d="M300 200 L400 150" fill="none" stroke="#22c55e" strokeWidth="2" />
                <path d="M500 150 L600 150" fill="none" stroke="#22c55e" strokeWidth="2" />
                {/* nodes */}
                <foreignObject height="50" width="120" x="20" y="125">
                  <div
                    className="bg-[#131315] border border-[#3d4a3d] rounded p-2 text-[10px] flex items-center gap-2"
                    style={{ ...mono, ...nodeGlow }}
                  >
                    <FileCode className="h-3 w-3" /> Source Code
                  </div>
                </foreignObject>
                <foreignObject height="50" width="120" x="180" y="75">
                  <div
                    className="bg-[#131315] border border-[#3d4a3d] rounded p-2 text-[10px] flex items-center gap-2 opacity-50"
                    style={mono}
                  >
                    <Search className="h-3 w-3" /> SAST Scan
                  </div>
                </foreignObject>
                <foreignObject height="50" width="120" x="180" y="175">
                  <div
                    className="bg-[#131315] border border-[#4be277] rounded p-2 text-[10px] flex items-center gap-2"
                    style={{ ...mono, ...nodeGlow }}
                  >
                    <Activity className="h-3 w-3 text-[#4be277]" /> DAST Scan
                  </div>
                </foreignObject>
                <foreignObject height="50" width="140" x="380" y="125">
                  <div
                    className="bg-[#131315] border border-[#3d4a3d] rounded p-2 text-[10px] flex items-center gap-2"
                    style={mono}
                  >
                    <BadgeCheck className="h-3 w-3" /> Dependency Check
                  </div>
                </foreignObject>
                <foreignObject height="50" width="110" x="580" y="125">
                  <div
                    className="bg-[#4be277]/10 border border-[#4be277] rounded p-2 text-[10px] flex items-center gap-2 text-[#4be277]"
                    style={mono}
                  >
                    <Send className="h-3 w-3" /> Send Report
                  </div>
                </foreignObject>
              </svg>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-[#3d4a3d] bg-[#0e0e10]">
        <div className="w-full py-10 px-6 md:px-16 flex flex-col md:flex-row justify-between items-center max-w-[1200px] mx-auto gap-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex items-center gap-2">
              <VulnCraftLogo className="h-6 w-6" />
              <span className="text-2xl font-bold tracking-tighter text-[#e5e1e4]">
                VulnCraft
              </span>
            </div>
            <span
              className="text-xs uppercase tracking-widest text-[#bccbb9] opacity-60"
              style={mono}
            >
              © 2026 VulnCraft Systems. Secure by Design.
            </span>
          </div>
          <div className="flex items-center gap-8" style={mono}>
            <span className="text-xs uppercase tracking-widest text-[#bccbb9]/60">Security</span>
            <span className="text-xs uppercase tracking-widest text-[#bccbb9]/60">Privacy</span>
            <span className="text-xs uppercase tracking-widest text-[#bccbb9]/60">Terms</span>
            <a className="text-xs uppercase tracking-widest text-[#bccbb9] hover:text-[#4be277] transition-colors" href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
