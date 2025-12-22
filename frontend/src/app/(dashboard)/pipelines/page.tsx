"use client";

import { PipelineList } from "@/components/pipelines";

export default function PipelinesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Pipelines</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Run automation pipelines with custom inputs. Results appear instantly.
        </p>
      </div>

      <PipelineList />
    </div>
  );
}

