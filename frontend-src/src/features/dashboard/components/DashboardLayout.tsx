import { ReactNode } from "react";
import Sidebar from "./Sidebar";

interface Props {
  children: ReactNode;
}

export default function DashboardLayout({ children }: Props) {
  return (
    <div className="min-h-screen w-full bg-[#f4f4f4] dark:bg-gray-950 transition-colors">
      <div className="min-h-screen w-full flex">
        <Sidebar />

        {/* Add left margin to account for fixed sidebar */}
        <div className="flex-1 ml-64 px-6 py-6 xl:px-10 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}