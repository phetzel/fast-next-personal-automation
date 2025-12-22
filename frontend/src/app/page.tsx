"use client";

import Link from "next/link";
import { Button, DottedGlowBackground } from "@/components/ui";
import { ROUTES } from "@/lib/constants";
import { useAuthStore } from "@/stores";

export default function HomePage() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="bg-background relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Radial mask container for circular dot effect */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, black 0%, black 50%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, black 0%, black 50%, transparent 80%)",
        }}
      >
        <DottedGlowBackground
          gap={18}
          radius={1.5}
          color="rgba(100, 100, 100, 0.5)"
          darkColor="rgba(180, 180, 180, 0.4)"
          glowColor="rgba(34, 211, 238, 0.95)"
          darkGlowColor="rgba(34, 211, 238, 0.9)"
          opacity={0.9}
          speedMin={0.2}
          speedMax={0.6}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 px-8 text-center">
        <h1 className="text-6xl font-black tracking-tight sm:text-7xl md:text-8xl lg:text-9xl">
          <span className="inline-block bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text px-2 text-transparent">
            AILIENS
          </span>
        </h1>

        <Button
          asChild
          size="lg"
          className="px-8 py-6 text-lg font-semibold shadow-lg transition-all hover:scale-105 hover:shadow-xl"
        >
          <Link href={isAuthenticated ? ROUTES.DASHBOARD : ROUTES.LOGIN}>
            {isAuthenticated ? "Dashboard" : "Login"}
          </Link>
        </Button>
      </div>
    </div>
  );
}
