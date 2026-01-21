"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Button from "@/components/ui/button";

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const routes = [
    { href: "/", label: "Home" },
    { href: "/edit", label: "Editor" },
    { href: "/train", label: "Training" },
    { href: "/simulate", label: "Simulation" },
  ];

  return (
    <>
      {/* Floating Hamburger Button */}
      <div className="fixed top-2 left-4 z-40">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsOpen(true)}
          className="bg-white/80 backdrop-blur-sm dark:bg-zinc-950/80"
          aria-label="Open menu"
        >
          {/* Hamburger Icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" x2="21" y1="6" y2="6" />
            <line x1="3" x2="21" y1="12" y2="12" />
            <line x1="3" x2="21" y1="18" y2="18" />
          </svg>
        </Button>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-950/20 backdrop-blur-sm dark:bg-zinc-950/50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sliding Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-zinc-200 bg-white p-6 shadow-xl transition-transform duration-300 ease-in-out dark:border-zinc-800 dark:bg-zinc-950 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            AVS-PEG
          </h2>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            {/* Close Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </Button>
        </div>

        <nav className="flex flex-col gap-2">
          {routes.map((route) => {
            const isActive = pathname === route.href;
            return (
              <Link
                key={route.href}
                href={route.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                }`}
              >
                {route.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
