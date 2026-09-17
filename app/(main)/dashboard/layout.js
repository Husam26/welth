import React, { Suspense } from "react";
import { BarLoader } from "react-spinners";

const Loader = () => (
  <div className="flex justify-center py-10">
    <BarLoader width="60%" color="#4f46e5" />
  </div>
);

export default function DashboardLayout({ children }) {
  return <Suspense fallback={<Loader />}>{children}</Suspense>;
}
