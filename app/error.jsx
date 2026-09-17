"use client";

// Route-level Error Boundary. Next.js renders this whenever a Server/Client
// component below it throws during rendering. It keeps the app from crashing to
// a blank screen and gives the user a way to recover.
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log to the console (and, in a real deployment, to an error reporter)
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <h1 className="mb-3 text-6xl font-semibold tracking-tight text-foreground">Oops!</h1>
      <h2 className="mb-2 text-xl font-semibold text-foreground">Something went wrong</h2>
      <p className="mb-8 max-w-md text-muted-foreground">
        An unexpected error occurred while loading this page. You can try again,
        or head back to your dashboard.
      </p>
      <div className="flex gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Link href="/dashboard">
          <Button variant="outline">Go to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
