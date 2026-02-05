import { createFileRoute } from "@tanstack/react-router";
import {
  Route as RouteIcon,
  Server,
  Shield,
  Sparkles,
  Waves,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: App });

function App() {
  const features = [
    {
      icon: <Zap className="h-12 w-12 text-cyan-400" />,
      title: "Fast Development",
      description:
        "Lightning-fast hot module replacement with Vite. See your changes instantly.",
    },
    {
      icon: <RouteIcon className="h-12 w-12 text-cyan-400" />,
      title: "Type-Safe Routing",
      description:
        "Built with TanStack Router for fully type-safe navigation and route parameters.",
    },
    {
      icon: <Shield className="h-12 w-12 text-cyan-400" />,
      title: "Strongly Typed",
      description:
        "End-to-end type safety with TypeScript. Catch errors before they reach production.",
    },
    {
      icon: <Server className="h-12 w-12 text-cyan-400" />,
      title: "Modern Tooling",
      description:
        "Built with modern tools and best practices. Fast builds and optimal performance.",
    },
    {
      icon: <Waves className="h-12 w-12 text-cyan-400" />,
      title: "Component Library",
      description:
        "Comprehensive UI component library ready to use. Build beautiful interfaces quickly.",
    },
    {
      icon: <Sparkles className="h-12 w-12 text-cyan-400" />,
      title: "Production Ready",
      description:
        "Optimized for production deployment. Deploy anywhere static sites are supported.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <section className="relative overflow-hidden px-6 py-20 text-center">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10" />
        <div className="relative mx-auto max-w-5xl">
          <h1 className="mb-6 font-black text-6xl text-white [letter-spacing:-0.08em] md:text-7xl">
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Dryft
            </span>
          </h1>
          <p className="mb-4 font-light text-2xl text-gray-300 md:text-3xl">
            Welcome to your application
          </p>
          <p className="mx-auto mb-8 max-w-3xl text-gray-400 text-lg">
            Built with React, Vite, and TanStack Router. Type-safe routing with
            modern tooling.
          </p>
          <div className="flex flex-col items-center gap-4">
            <p className="mt-2 text-gray-400 text-sm">
              Get started by editing{" "}
              <code className="rounded bg-slate-700 px-2 py-1 text-cyan-400">
                /src/routes/index.tsx
              </code>
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <div
              className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur-sm transition-all duration-300 hover:border-cyan-500/50 hover:shadow-cyan-500/10 hover:shadow-lg"
              key={index}
            >
              <div className="mb-4">{feature.icon}</div>
              <h3 className="mb-3 font-semibold text-white text-xl">
                {feature.title}
              </h3>
              <p className="text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
