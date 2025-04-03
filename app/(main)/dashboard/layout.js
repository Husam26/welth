import React, { Suspense } from "react";

const Loader = () => (
  <div className="flex flex-col items-center space-y-3 w-full mt-6">
    {/* Shimmering loading text placeholders */}
    <div className="w-3/4 h-4 rounded-lg bg-gray-300 animate-pulse"></div>
    <div className="w-2/3 h-4 rounded-lg bg-gray-300 animate-pulse"></div>
    <div className="w-1/2 h-4 rounded-lg bg-gray-300 animate-pulse"></div>

    {/* Moving gradient bar loader */}
    <div className="w-full h-1 mt-4 bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 animate-pulse"></div>
  </div>
);

export default function DashboardLayout({ children }) {
  return (
    <div className="px-5">
      <h1 className="text-6xl font-extrabold bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-transparent bg-clip-text mb-6">
        Dashboard
      </h1>
      
      {/* Suspense Loader with Shimmer Effect */}
      <Suspense fallback={<Loader />}>{children}</Suspense>
    </div>
  );
}
