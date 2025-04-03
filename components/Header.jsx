import {
    SignInButton,
    SignUpButton,
    SignedIn,
    SignedOut,
    UserButton,
  } from "@clerk/nextjs";
  import Image from "next/image";
  import Link from "next/link";
  import React from "react";
  import { Button } from "./ui/button";
  import { LayoutDashboard, PenBox } from "lucide-react";
  import { checkUser } from "@/lib/checkUser";

  
  const Header = async () => {
    await checkUser();
    
    return (
      <div className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b shadow-md">
        <nav className="container mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/">
            {/* Logo with a smaller height */}
            <Image
              src="/logo.jpg"
              alt="Logo"
              width={120} // Adjust width as needed
              height={40} // Adjust height for a smaller logo
              className="object-contain"
            />
          </Link>
  
          <div className="flex items-center space-x-4">
            <SignedIn>
              <Link href="/dashboard" className="text-gray-700 hover:text-blue-600 flex items-center gap-2">
                <Button variant="outline" className="text-sm py-2 px-4">
                  <LayoutDashboard size={18} />
                  <span className="hidden md:inline">Dashboard</span>
                </Button>
              </Link>
  
              <Link href="/transaction/create">
                <Button className="flex items-center gap-2 text-sm py-2 px-4">
                  <PenBox size={18} />
                  <span className="hidden md:inline">Create Transaction</span>
                </Button>
              </Link>
            </SignedIn>
  
            <SignedOut>
              <SignInButton forceRedirectUrl="/dashboard">
                <Button variant="outline" className="text-sm py-2 px-4">Login</Button>
              </SignInButton>
            </SignedOut>
  
            <SignedIn>
              <UserButton appearance={{
                elements: {
                  avatarBox: "w-8 h-8", // Adjust size for the user avatar
                },
              }} />
            </SignedIn>
          </div>
        </nav>
      </div>
    );
  };
  
  export default Header;
  