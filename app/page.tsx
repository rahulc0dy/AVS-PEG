import Link from "next/link";

// Icons
const EditIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

const BrainIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
  </svg>
);

const PlayIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="6 3 20 12 6 21 6 3" />
  </svg>
);

const MapIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
    <line x1="9" y1="3" x2="9" y2="18" />
    <line x1="15" y1="6" x2="15" y2="21" />
  </svg>
);

const ShieldIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const CodeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 selection:bg-green-500/30">
      {/* Hero Section */}
      <div className="relative overflow-hidden pt-32 pb-20 lg:pt-48 lg:pb-32">
        <div className="container mx-auto px-6 relative z-10 text-center">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-linear-to-b from-white to-zinc-500">
            AVS
          </h1>
          <p className="text-xl md:text-2xl text-zinc-400 max-w-3xl mx-auto mb-12 font-medium">
            Autonomous Vehicle Simulation <br className="hidden md:block" />
            <span className="text-zinc-500">With Environment Editing</span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-16">
            {/* Cards */}
            <Link
              href="/edit"
              className="group relative rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 hover:bg-zinc-900 transition-all overflow-hidden text-left hover:border-green-500/50 hover:shadow-[0_0_30px_-5px_rgba(34,197,94,0.15)]"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-green-500">
                <EditIcon />
              </div>
              <div className="h-14 w-14 rounded-xl bg-zinc-800 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-green-500/20 text-zinc-400 group-hover:text-green-400 transition-all duration-300">
                <EditIcon />
              </div>
              <h3 className="text-xl font-bold mb-3">Environment Editor</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Design complex road networks, intersections, and traffic logic.
                Import OpenStreetMap data or build your own custom city from
                scratch.
              </p>
            </Link>

            <Link
              href="/train"
              className="group relative rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 hover:bg-zinc-900 transition-all overflow-hidden text-left hover:border-emerald-500/50 hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.15)]"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-emerald-500">
                <BrainIcon />
              </div>
              <div className="h-14 w-14 rounded-xl bg-zinc-800 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-emerald-500/20 text-zinc-400 group-hover:text-emerald-400 transition-all duration-300">
                <BrainIcon />
              </div>
              <h3 className="text-xl font-bold mb-3">AI Training</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Train autonomous agents using neuro-evolution. Monitor fitness
                scores, adjust neural networks, and watch cars learn to navigate
                traffic.
              </p>
            </Link>

            <Link
              href="/simulate"
              className="group relative rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 hover:bg-zinc-900 transition-all overflow-hidden text-left hover:border-teal-500/50 hover:shadow-[0_0_30px_-5px_rgba(20,184,166,0.15)]"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-teal-500">
                <PlayIcon />
              </div>
              <div className="h-14 w-14 rounded-xl bg-zinc-800 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-teal-500/20 text-zinc-400 group-hover:text-teal-400 transition-all duration-300">
                <PlayIcon />
              </div>
              <h3 className="text-xl font-bold mb-3">Live Simulation</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Run realistic traffic simulations. Manually drive vehicles
                yourself or let the trained AI navigate through the custom road
                environments.
              </p>
            </Link>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 border-t border-zinc-900 bg-zinc-950/50 relative overflow-hidden">
        <div className="absolute -left-40 top-40 w-[400px] h-[400px] bg-green-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Core Features
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Built with Next.js, Three.js, and modern web technologies to
              provide a high-performance simulation directly in your browser.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 max-w-6xl mx-auto">
            <div className="flex gap-4">
              <div className="shrink-0 h-10 w-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                <MapIcon />
              </div>
              <div>
                <h4 className="text-lg font-bold mb-2">OSM Integration</h4>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Import real-world road networks from OpenStreetMap to test
                  your AI in authentic city environments.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0 h-10 w-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                <ShieldIcon />
              </div>
              <div>
                <h4 className="text-lg font-bold mb-2">
                  Custom Physics Engine
                </h4>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Offloaded vehicle physics running entirely in Web Workers to
                  keep the simulation smooth at high vehicle counts.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0 h-10 w-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                <CodeIcon />
              </div>
              <div>
                <h4 className="text-lg font-bold mb-2">
                  Live Neural Inspector
                </h4>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Visualize and interactively tweak neural network weights and
                  biases in real-time while the simulation runs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-12 bg-zinc-950 text-center text-zinc-500 text-sm">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between">
          <p>AVS-PEG &copy; {new Date().getFullYear()}</p>
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            <Link
              href="https://github.com/rahulc0dy/AVS-PEG"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              GitHub
            </Link>
            <span className="w-1 h-1 rounded-full bg-zinc-800"></span>
            <span className="text-zinc-600">
              Built with Next.js 16 & Three.js
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
