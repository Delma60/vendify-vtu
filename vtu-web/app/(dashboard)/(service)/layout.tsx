import BalanceCard from "@/components/services/balance";
import { env } from "@/lib/utils/env";
import React from "react";

const Layout = async ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="col-span-1 md:col-span-2">
        <div className="block md:hidden">
          <BalanceCard />
        </div>
        <div className="md:pt-0 py-5">{children}</div>
      </div>
      <div className="col-span-1 md:col-span-1 hidden md:block">
        <BalanceCard />
      </div>
    </div>
  );
};

export default Layout;
