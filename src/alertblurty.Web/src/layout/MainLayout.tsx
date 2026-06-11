import { Outlet } from "react-router-dom";

import { NavMenu } from "./NavMenu";

export function MainLayout() {
  return (
    <div className="app-shell">
      <NavMenu />
      <main className="app-main">
        <div className="container py-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
