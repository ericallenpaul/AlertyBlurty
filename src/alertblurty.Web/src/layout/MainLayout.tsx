import { Outlet } from "react-router-dom";

import { NavMenu } from "./NavMenu";

export function MainLayout() {
  return (
    <div>
      <NavMenu />
      <main className="container py-4">
        <Outlet />
      </main>
    </div>
  );
}
