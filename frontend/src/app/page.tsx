"use client";

import Link from "next/link";
import { Button, DottedGlowBackground } from "@/components/ui";
import { ROUTES } from "@/lib/constants";
import { useAuthStore } from "@/stores";

export default function HomePage() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="bg-background relative flex min-h-screen items-center justify-center overflow-hidden">
      <DottedGlowBackground
        gap={20}
        radius={1.5}
        color="rgba(120, 120, 120, 0.4)"
        darkColor="rgba(200, 200, 200, 0.3)"
        glowColor="rgba(34, 211, 238, 0.9)"
        darkGlowColor="rgba(34, 211, 238, 0.8)"
        opacity={0.8}
        speedMin={0.3}
        speedMax={0.8}
      />

      <div className="relative z-10 flex flex-col items-center gap-8 px-4 text-center">
        <h1 className="text-6xl font-black tracking-tighter sm:text-7xl md:text-8xl lg:text-9xl">
          <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
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
