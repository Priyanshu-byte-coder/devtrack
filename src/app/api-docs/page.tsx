"use client";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

export default function ApiDocsPage() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="max-w-6xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-2 text-[var(--foreground)]">
          DevTrack API Docs
        </h1>
        <p className="text-[var(--muted-foreground)] mb-6">
          Interactive documentation for all DevTrack API endpoints.
        </p>
        <SwaggerUI url="/openapi.yaml" />
      </div>
    </main>
  );
}

