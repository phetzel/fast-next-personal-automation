"use client";

import { useEffect, useState } from "react";

interface AppConfig {
  registration_enabled: boolean;
}

const defaultConfig: AppConfig = {
  registration_enabled: false,
};

export function useConfig() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const response = await fetch("/api/config");
        if (response.ok) {
          const data = await response.json();
          setConfig(data);
        }
      } catch {
        // Use defaults on error
      } finally {
        setIsLoading(false);
      }
    }
    fetchConfig();
  }, []);

  return { config, isLoading };
}

