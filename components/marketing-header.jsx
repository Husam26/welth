import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/theme-toggle";
import { checkUser } from "@/lib/checkUser";

// Slim public top-nav for the marketing/landing page.
export default async function MarketingHeader() {
  await checkUser();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/70 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">
            W
          </span>
          <span className="text-lg font-semibold tracking-tight">Welth</span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignedOut>
            <SignInButton forceRedirectUrl="/dashboard">
              <Button variant="ghost">Sign in</Button>
            </SignInButton>
            <Link href="/dashboard">
              <Button>Get Started</Button>
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard">
              <Button variant="outline">Dashboard</Button>
            </Link>
            <UserButton appearance={{ elements: { avatarBox: "size-8" } }} />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
