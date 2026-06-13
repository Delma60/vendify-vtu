import type { ReactNode } from "react";

export const metadata = {
  title: "Auth | VTU Platform",
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">{children}</div>
  );
}
