# React Frontend Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Blazor Server frontend in `src/alertblurty.Web` with a React single-page app while preserving the existing ASP.NET Core API, auth flow, routes, and user workflows.

**Architecture:** Keep `src/alertblurty.Api`, `src/alertblurty.Data`, `src/alertblurty.Models`, and `tests/alertblurty.Tests` as the backend system. Replace `src/alertblurty.Web` with a Vite React TypeScript app that talks to the existing API over HTTP, stores the JWT in browser local storage under the existing `authToken` key, and protects routes client-side based on decoded JWT role claims. Build the React app independently with Node and serve it in production either as static assets or through the existing deployment pipeline.

**Tech Stack:** React, TypeScript, Vite, React Router, TanStack Query, Axios, Vitest, Testing Library, Playwright, Bootstrap-compatible CSS during the first migration pass.

---

## File Structure

Create these React files under `src/alertblurty.Web` after removing Blazor-specific files:

- `package.json`: npm scripts and frontend dependencies.
- `vite.config.ts`: Vite config, dev proxy to `http://localhost:5041`, test config.
- `tsconfig.json`, `tsconfig.node.json`: TypeScript compiler settings.
- `index.html`: SPA shell.
- `src/main.tsx`: React root bootstrap.
- `src/App.tsx`: Router and route composition.
- `src/config.ts`: API base URL resolution from `VITE_API_BASE_URL`.
- `src/api/http.ts`: Axios instance with auth header and 401 handling.
- `src/api/auth.ts`, `src/api/incidents.ts`, `src/api/organizations.ts`, `src/api/teams.ts`, `src/api/users.ts`: endpoint clients matching the current C# service wrappers.
- `src/types/api.ts`: TypeScript DTO/request/response types copied from `alertblurty.Models`.
- `src/auth/tokenStore.ts`: localStorage wrapper for `authToken`.
- `src/auth/jwt.ts`: JWT claim decoding helpers.
- `src/auth/AuthProvider.tsx`: auth context and login/logout/register actions.
- `src/auth/ProtectedRoute.tsx`: authenticated and role-gated route wrapper.
- `src/layout/MainLayout.tsx`, `src/layout/NavMenu.tsx`: shared app chrome.
- `src/pages/HomeRedirect.tsx`: replaces `Pages/Index.razor`.
- `src/pages/LoginPage.tsx`, `src/pages/LogoutPage.tsx`, `src/pages/SetupPage.tsx`, `src/pages/DashboardPage.tsx`, `src/pages/UserInfoPage.tsx`.
- `src/pages/incidents/IncidentsPage.tsx`, `src/pages/incidents/IncidentDetailsPage.tsx`.
- `src/pages/teams/TeamsPage.tsx`, `src/pages/teams/TeamDetailsPage.tsx`.
- `src/pages/users/UsersPage.tsx`, `src/pages/users/CreateUserPage.tsx`, `src/pages/users/UserDetailsPage.tsx`.
- `src/components/*`: shared `LoadingState`, `ErrorAlert`, `StatusBadge`, `SeverityBadge`, and form components.
- `src/styles/site.css`, `src/styles/alertyblurty.css`: migrated CSS from `wwwroot/css/site.css` and `wwwroot/css/alertyblurty.css`.
- `tests/e2e/react-auth.spec.ts`: Playwright login/dashboard smoke.

Remove these Blazor files when their React equivalents exist:

- `src/alertblurty.Web/*.razor`
- `src/alertblurty.Web/Pages/**/*.razor`
- `src/alertblurty.Web/Pages/_Host.cshtml`
- `src/alertblurty.Web/Pages/Error.cshtml`
- `src/alertblurty.Web/Pages/Error.cshtml.cs`
- `src/alertblurty.Web/Shared/**/*.razor`
- `src/alertblurty.Web/Services/*.cs`
- `src/alertblurty.Web/Models/ApiSettings.cs`
- `src/alertblurty.Web/alertblurty.Web.csproj`
- `src/alertblurty.Web/Program.cs`
- `src/alertblurty.Web/_Imports.razor`

Keep these assets initially:

- `src/alertblurty.Web/wwwroot/logo.png`
- `src/alertblurty.Web/wwwroot/logo_darkmode.png`
- `src/alertblurty.Web/wwwroot/favicon.png`
- Bootstrap CSS may be imported from npm or copied during the first pass to reduce visual churn.

## Task 1: Establish React Tooling Skeleton

**Files:**
- Delete: `src/alertblurty.Web/alertblurty.Web.csproj`
- Delete: `src/alertblurty.Web/Program.cs`
- Delete: `src/alertblurty.Web/_Imports.razor`
- Create: `src/alertblurty.Web/package.json`
- Create: `src/alertblurty.Web/vite.config.ts`
- Create: `src/alertblurty.Web/tsconfig.json`
- Create: `src/alertblurty.Web/tsconfig.node.json`
- Create: `src/alertblurty.Web/index.html`
- Create: `src/alertblurty.Web/src/main.tsx`
- Create: `src/alertblurty.Web/src/App.tsx`
- Modify: `alertblurty.sln`

- [ ] **Step 1: Remove the Blazor project from the .NET solution**

Run:

```powershell
dotnet sln alertblurty.sln remove src\alertblurty.Web\alertblurty.Web.csproj
```

Expected: `Project 'src\alertblurty.Web\alertblurty.Web.csproj' removed from the solution.`

- [ ] **Step 2: Create npm package metadata**

Create `src/alertblurty.Web/package.json`:

```json
{
  "name": "alertblurty-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1 --port 5260",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 127.0.0.1 --port 5260",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "format": "prettier --check ."
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.1.1",
    "axios": "^1.13.2",
    "bootstrap": "^5.3.8",
    "bootstrap-icons": "^1.13.1",
    "jwt-decode": "^4.0.0",
    "react": "^19.2.1",
    "react-dom": "^19.2.1",
    "react-router-dom": "^7.10.1",
    "@tanstack/react-query": "^5.90.12"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^24.10.1",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "@vitest/browser": "^4.0.15",
    "eslint": "^9.39.1",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.4.24",
    "jsdom": "^27.2.0",
    "prettier": "^3.7.4",
    "typescript": "~5.9.3",
    "vite": "^7.2.6",
    "vitest": "^4.0.15"
  }
}
```

- [ ] **Step 3: Create Vite config**

Create `src/alertblurty.Web/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5260,
    proxy: {
      '/api': 'http://127.0.0.1:5041',
      '/health': 'http://127.0.0.1:5041',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

- [ ] **Step 4: Create TypeScript configs**

Create `src/alertblurty.Web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `src/alertblurty.Web/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Create initial React shell**

Create `src/alertblurty.Web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <title>AlertyBlurty</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/alertblurty.Web/src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/site.css';
import './styles/alertyblurty.css';
import { App } from './App';
import { AuthProvider } from './auth/AuthProvider';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
```

Create `src/alertblurty.Web/src/App.tsx`:

```tsx
export function App() {
  return <div>AlertyBlurty React migration shell</div>;
}
```

- [ ] **Step 6: Install and verify**

Run:

```powershell
cd src\alertblurty.Web
npm install
npm run build
```

Expected: Vite build completes and writes `dist/`.

- [ ] **Step 7: Commit**

```powershell
git add alertblurty.sln src\alertblurty.Web
git commit -m "chore: replace blazor shell with react tooling"
```

## Task 2: Port API Types and HTTP Client

**Files:**
- Create: `src/alertblurty.Web/src/types/api.ts`
- Create: `src/alertblurty.Web/src/config.ts`
- Create: `src/alertblurty.Web/src/auth/tokenStore.ts`
- Create: `src/alertblurty.Web/src/api/http.ts`
- Create: `src/alertblurty.Web/src/api/auth.ts`
- Create: `src/alertblurty.Web/src/api/users.ts`
- Create: `src/alertblurty.Web/src/api/teams.ts`
- Create: `src/alertblurty.Web/src/api/incidents.ts`
- Create: `src/alertblurty.Web/src/api/organizations.ts`
- Test: `src/alertblurty.Web/src/api/http.test.ts`

- [ ] **Step 1: Create shared API types**

Create `src/alertblurty.Web/src/types/api.ts` with DTOs and request shapes used by existing pages:

```ts
export type UserRole = 'User' | 'Admin' | 'SuperAdmin';

export enum IncidentStatus {
  Open = 0,
  Acknowledged = 1,
  Resolved = 2,
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface UserDto {
  id: string;
  organizationId: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  timezone: string;
  role: UserRole;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc?: string;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: UserDto;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  timezone: string;
  organizationName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface OrganizationDto {
  id: string;
  name: string;
  defaultTimezone: string;
  isSetupComplete: boolean;
  createdAtUtc: string;
  updatedAtUtc?: string;
}

export interface TeamDto {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  requireAdminApprovalForSwaps: boolean;
  createdAtUtc: string;
  updatedAtUtc?: string;
}

export interface CreateTeamRequest {
  name: string;
  description: string;
  requireAdminApprovalForSwaps: boolean;
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  requireAdminApprovalForSwaps?: boolean;
}

export interface TeamMemberDto {
  id: string;
  teamId: string;
  userId: string;
  userFullName?: string;
  userEmail?: string;
  rotationOrder: number;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc?: string;
}

export interface AddTeamMemberRequest {
  userId: string;
  rotationOrder: number;
}

export interface CreateUserRequest {
  organizationId: string;
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  timezone: string;
  role: UserRole;
  isActive: boolean;
}

export interface UpdateUserRequest {
  fullName?: string;
  phoneNumber?: string;
  timezone?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface IncidentDto {
  id: string;
  teamId: string;
  teamName?: string;
  zabbixEventId: string;
  zabbixTriggerId: string;
  hostName: string;
  triggerName: string;
  triggerDescription: string;
  severity: number;
  firstOccurrenceUtc: string;
  lastOccurrenceUtc: string;
  eventCount: number;
  status: IncidentStatus;
  acknowledgedByUserId?: string;
  acknowledgedAtUtc?: string;
  acknowledgedByUserName?: string;
  createdAtUtc: string;
  updatedAtUtc?: string;
}
```

- [ ] **Step 2: Create config and token store**

Create `src/alertblurty.Web/src/config.ts`:

```ts
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
```

Create `src/alertblurty.Web/src/auth/tokenStore.ts`:

```ts
const tokenKey = 'authToken';

export function getToken(): string | null {
  return window.localStorage.getItem(tokenKey);
}

export function setToken(token: string): void {
  window.localStorage.setItem(tokenKey, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(tokenKey);
}
```

- [ ] **Step 3: Create Axios HTTP client**

Create `src/alertblurty.Web/src/api/http.ts`:

```ts
import axios from 'axios';
import { apiBaseUrl } from '../config';
import { getToken } from '../auth/tokenStore';

export const http = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

- [ ] **Step 4: Write HTTP client test**

Create `src/alertblurty.Web/src/api/http.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../auth/tokenStore', () => ({
  getToken: vi.fn(() => 'abc123'),
}));

describe('http client', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('adds bearer token to outgoing requests', async () => {
    const { http } = await import('./http');
    const handler = http.interceptors.request.handlers[0].fulfilled;
    const config = handler({ headers: {} });
    expect(config.headers.Authorization).toBe('Bearer abc123');
  });
});
```

- [ ] **Step 5: Create endpoint clients**

Create `src/alertblurty.Web/src/api/auth.ts`:

```ts
import { http } from './http';
import type { ApiResponse, AuthResponse, LoginRequest, RegisterRequest } from '../types/api';

export async function register(request: RegisterRequest): Promise<AuthResponse | null> {
  const response = await http.post<ApiResponse<AuthResponse>>('/api/auth/register', request);
  return response.data.data ?? null;
}

export async function login(request: LoginRequest): Promise<AuthResponse | null> {
  const response = await http.post<ApiResponse<AuthResponse>>('/api/auth/login', request);
  return response.data.data ?? null;
}
```

Create `src/alertblurty.Web/src/api/users.ts`:

```ts
import { http } from './http';
import type { CreateUserRequest, UpdateUserRequest, UserDto } from '../types/api';

export async function getMe(): Promise<UserDto> {
  const response = await http.get<UserDto>('/api/users/me');
  return response.data;
}

export async function getUser(id: string): Promise<UserDto> {
  const response = await http.get<UserDto>(`/api/users/${id}`);
  return response.data;
}

export async function getUsersByOrganization(organizationId: string): Promise<UserDto[]> {
  const response = await http.get<UserDto[]>(`/api/users/organization/${organizationId}`);
  return response.data;
}

export async function createUser(request: CreateUserRequest): Promise<UserDto> {
  const response = await http.post<UserDto>('/api/users', request);
  return response.data;
}

export async function updateUser(id: string, request: UpdateUserRequest): Promise<UserDto> {
  const response = await http.put<UserDto>(`/api/users/${id}`, request);
  return response.data;
}

export async function deleteUser(id: string): Promise<void> {
  await http.delete(`/api/users/${id}`);
}
```

Create matching clients for teams, incidents, and organizations using the paths listed in `src/alertblurty.Api/Endpoints`.

- [ ] **Step 6: Run tests**

```powershell
cd src\alertblurty.Web
npm test
npm run build
```

Expected: tests pass and TypeScript build succeeds.

- [ ] **Step 7: Commit**

```powershell
git add src\alertblurty.Web
git commit -m "feat: add react api client layer"
```

## Task 3: Implement Auth, Routing, and Layout

**Files:**
- Create: `src/alertblurty.Web/src/auth/jwt.ts`
- Create: `src/alertblurty.Web/src/auth/AuthProvider.tsx`
- Create: `src/alertblurty.Web/src/auth/ProtectedRoute.tsx`
- Create: `src/alertblurty.Web/src/layout/MainLayout.tsx`
- Create: `src/alertblurty.Web/src/layout/NavMenu.tsx`
- Modify: `src/alertblurty.Web/src/App.tsx`
- Test: `src/alertblurty.Web/src/auth/AuthProvider.test.tsx`

- [ ] **Step 1: Implement JWT decoding helpers**

Create `src/alertblurty.Web/src/auth/jwt.ts`:

```ts
import { jwtDecode } from 'jwt-decode';
import type { UserRole } from '../types/api';

interface JwtClaims {
  nameid?: string;
  email?: string;
  role?: UserRole;
  OrganizationId?: string;
  exp?: number;
  [key: string]: unknown;
}

export interface AuthClaims {
  userId: string;
  email: string;
  role: UserRole;
  organizationId: string;
}

export function decodeAuthClaims(token: string): AuthClaims | null {
  const claims = jwtDecode<JwtClaims>(token);
  const userId = claims.nameid || String(claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || '');
  const email = claims.email || String(claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || '');
  const role = claims.role || (claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] as UserRole | undefined);
  const organizationId = claims.OrganizationId || '';
  const expiresAtMs = claims.exp ? claims.exp * 1000 : 0;

  if (!userId || !email || !role || !organizationId || expiresAtMs <= Date.now()) {
    return null;
  }

  return { userId, email, role, organizationId };
}
```

- [ ] **Step 2: Implement auth provider**

Create `src/alertblurty.Web/src/auth/AuthProvider.tsx` with a context exposing `claims`, `isAuthenticated`, `login`, `register`, and `logout`. Store tokens using `setToken`, clear invalid tokens on startup, and navigate after actions from pages rather than from the provider.

- [ ] **Step 3: Implement protected routes**

Create `src/alertblurty.Web/src/auth/ProtectedRoute.tsx`:

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import type { UserRole } from '../types/api';
import { useAuth } from './AuthProvider';

interface ProtectedRouteProps {
  roles?: UserRole[];
}

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { claims, isAuthenticated } = useAuth();

  if (!isAuthenticated || !claims) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(claims.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
```

- [ ] **Step 4: Implement layout and nav**

Create `MainLayout.tsx` and `NavMenu.tsx` with Bootstrap layout matching the current Blazor `Shared/MainLayout.razor` and `Shared/NavMenu.razor`. Show Dashboard, Incidents, Teams, User Info, and Logout for authenticated users. Show Users and Setup only for `Admin` or `SuperAdmin` where current Blazor navigation allows it.

- [ ] **Step 5: Wire route skeleton**

Update `src/App.tsx`:

```tsx
import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { MainLayout } from './layout/MainLayout';
import { HomeRedirect } from './pages/HomeRedirect';
import { LoginPage } from './pages/LoginPage';
import { LogoutPage } from './pages/LogoutPage';
import { DashboardPage } from './pages/DashboardPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/logout" element={<LogoutPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
```

- [ ] **Step 6: Verify**

Run:

```powershell
cd src\alertblurty.Web
npm test
npm run build
```

Expected: tests and build pass.

- [ ] **Step 7: Commit**

```powershell
git add src\alertblurty.Web
git commit -m "feat: add react auth and routing"
```

## Task 4: Port Core Pages

**Files:**
- Create/modify: all `src/alertblurty.Web/src/pages/**/*.tsx`
- Create/modify: all `src/alertblurty.Web/src/components/**/*.tsx`
- Test: focused component tests for login, dashboard, teams, incidents.

- [ ] **Step 1: Port `HomeRedirect`**

Implement the existing root behavior:

1. If authenticated, navigate to `/dashboard`.
2. Else call organization availability logic.
3. If organizations exist, navigate to `/login`.
4. If organizations do not exist, navigate to `/setup`.

Important: the existing Blazor `OrganizationApiService` calls `/api/organizations`, but the current API does not define that endpoint. Preserve the current behavior initially, then add a backend endpoint in Task 5 if setup routing must be accurate.

- [ ] **Step 2: Port `LoginPage` and `LogoutPage`**

Use placeholders and labels matching the current Blazor UI:

- Email placeholder: `your.email@example.com`
- Password placeholder: `Enter your password`
- Submit button: `Sign In`
- On successful login, store token and navigate to `/dashboard`.
- On failed login, show `Invalid email or password.`

- [ ] **Step 3: Port `SetupPage` and `RegisterPage` behavior**

Use the existing register endpoint. Keep the first-user-is-SuperAdmin behavior. On successful setup registration, store token and navigate to `/dashboard`.

- [ ] **Step 4: Port `DashboardPage`**

Use `getOpenIncidents()`. Preserve the current summary cards:

- Active Incidents
- Acknowledged
- My Teams
- Resolved Today

Keep `My Teams` at `0` unless a backend summary endpoint is added later.

- [ ] **Step 5: Port Incidents pages**

Implement:

- `/incidents`: list open incidents and allow status filtering if current page has it.
- `/incidents/:id`: incident details.
- Acknowledge action calls `POST /api/incidents/{id}/acknowledge` and refreshes the query.

- [ ] **Step 6: Port Teams pages**

Implement:

- `/teams`: list teams for the logged-in user organization using `claims.organizationId`.
- Create team modal/form for `Admin` and `SuperAdmin`.
- `/teams/:id`: details, members list, add/remove member for `Admin` and `SuperAdmin`.

- [ ] **Step 7: Port Users pages**

Implement:

- `/users`: list users for `claims.organizationId`.
- `/users/create`: create a user.
- `/users/:id`: user details and update/delete actions according to current route role constraints.

- [ ] **Step 8: Verify page behavior with tests**

Run:

```powershell
cd src\alertblurty.Web
npm test
npm run build
```

Expected: component tests pass and build succeeds.

- [ ] **Step 9: Commit**

```powershell
git add src\alertblurty.Web
git commit -m "feat: port blazor pages to react"
```

## Task 5: Close API Gaps Needed by React

**Files:**
- Modify: `src/alertblurty.Api/Program.cs`
- Create: `src/alertblurty.Api/Endpoints/OrganizationEndpoints.cs`
- Modify: `tests/alertblurty.Tests/UnitTest1.cs` or create focused API integration tests.

- [ ] **Step 1: Add missing organization endpoint**

The current Blazor `OrganizationApiService` assumes `GET /api/organizations`, but `src/alertblurty.Api/Endpoints` does not provide it. Add an endpoint that returns organizations for setup detection.

Create `src/alertblurty.Api/Endpoints/OrganizationEndpoints.cs`:

```csharp
using alertblurty.Models.Interfaces;

namespace alertblurty.Api.Endpoints;

public static class OrganizationEndpoints
{
    public static void MapOrganizationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/organizations")
            .WithTags("Organizations");

        group.MapGet("/", async (
            [FromServices] IOrganizationRepository organizationRepository,
            CancellationToken cancellationToken) =>
        {
            var organizations = await organizationRepository.GetAllAsync(cancellationToken);
            return Results.Ok(organizations);
        })
        .WithName("GetOrganizations");
    }
}
```

If `IOrganizationRepository.GetAllAsync` does not exist, add it to `src/alertblurty.Models/Interfaces/IOrganizationRepository.cs` and implement it in `src/alertblurty.Data/Repositories/OrganizationRepository.cs`.

- [ ] **Step 2: Register endpoint**

In `src/alertblurty.Api/Program.cs`, add:

```csharp
app.MapOrganizationEndpoints();
```

Place it beside the other endpoint mappings.

- [ ] **Step 3: Add backend tests**

Add an API integration test that registers a user, then calls `GET /api/organizations` and expects at least one organization with the registered organization name.

- [ ] **Step 4: Verify backend**

Run:

```powershell
dotnet restore alertblurty.sln
dotnet build alertblurty.sln --configuration Release --no-restore
dotnet test alertblurty.sln --configuration Release --no-build
```

Expected: build passes and all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src\alertblurty.Api src\alertblurty.Data src\alertblurty.Models tests\alertblurty.Tests
git commit -m "feat: add organizations endpoint for frontend setup"
```

## Task 6: Remove Remaining Blazor Artifacts and Update CI

**Files:**
- Delete: remaining `.razor`, `.cshtml`, Blazor service files under `src/alertblurty.Web`.
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `README.md`
- Modify: `docs/environment-variables.md`

- [ ] **Step 1: Remove Blazor artifacts**

Run:

```powershell
Remove-Item -LiteralPath 'src\alertblurty.Web\App.razor','src\alertblurty.Web\_Imports.razor' -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath 'src\alertblurty.Web\Pages','src\alertblurty.Web\Shared','src\alertblurty.Web\Services','src\alertblurty.Web\Models' -Recurse -Force -ErrorAction SilentlyContinue
```

Keep `wwwroot` assets only if React imports them or Vite copies them.

- [ ] **Step 2: Update CI**

In `.github/workflows/ci.yml`, keep backend restore/build/test, then add:

```yaml
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: src/alertblurty.Web/package-lock.json

      - name: Install frontend dependencies
        working-directory: src/alertblurty.Web
        run: npm ci

      - name: Build frontend
        working-directory: src/alertblurty.Web
        run: npm run build

      - name: Test frontend
        working-directory: src/alertblurty.Web
        run: npm test
```

- [ ] **Step 3: Update release**

In `.github/workflows/release.yml`, build the React frontend before publishing release artifacts. Upload `src/alertblurty.Web/dist` as a separate artifact named `alertblurty-web-${{ github.ref_name }}`.

- [ ] **Step 4: Update docs**

Update README run instructions:

```powershell
dotnet run --project src\alertblurty.Api\alertblurty.Api.csproj
cd src\alertblurty.Web
npm install
npm run dev
```

Document `VITE_API_BASE_URL`:

```env
VITE_API_BASE_URL=http://localhost:5041
```

- [ ] **Step 5: Verify**

Run:

```powershell
dotnet build alertblurty.sln --configuration Release
dotnet test alertblurty.sln --configuration Release --no-build
cd src\alertblurty.Web
npm ci
npm test
npm run build
```

Expected: all commands pass.

- [ ] **Step 6: Commit**

```powershell
git add .github README.md docs src\alertblurty.Web
git commit -m "chore: remove blazor artifacts and update frontend ci"
```

## Task 7: End-to-End Local Validation

**Files:**
- Create: `tests/e2e/react-auth.spec.ts`
- Create or modify: Playwright config if the repo chooses to keep E2E tests under version control.

- [ ] **Step 1: Start local dependencies**

Ensure local Postgres roles and EF migrations are applied as documented. Start API:

```powershell
$env:ASPNETCORE_URLS='http://127.0.0.1:5041'
$env:ASPNETCORE_ENVIRONMENT='Development'
dotnet run --project src\alertblurty.Api\alertblurty.Api.csproj --no-launch-profile
```

Start React:

```powershell
cd src\alertblurty.Web
$env:VITE_API_BASE_URL='http://127.0.0.1:5041'
npm run dev
```

- [ ] **Step 2: Run API smoke**

Use REST calls to:

1. `POST /api/auth/register`
2. `POST /api/auth/login`
3. `POST /api/teams/`
4. `POST /api/webhooks/zabbix/{teamId}`
5. `GET /api/incidents/team/{teamId}`

Expected: registration succeeds, login returns JWT, team is created, webhook creates an incident, incident list includes the Zabbix event id.

- [ ] **Step 3: Run Playwright login smoke**

Test:

1. Navigate to `http://127.0.0.1:5260/login`.
2. Fill email and password.
3. Click `Sign In`.
4. Wait for `/dashboard`.
5. Assert dashboard text is visible.
6. Assert no browser console errors.

- [ ] **Step 4: Run full verification**

```powershell
dotnet build alertblurty.sln --configuration Release
dotnet test alertblurty.sln --configuration Release --no-build
cd src\alertblurty.Web
npm test
npm run build
```

Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add tests src\alertblurty.Web
git commit -m "test: add react frontend e2e smoke"
```

## Task 8: Production Hosting Decision

**Files:**
- Modify after decision: deployment scripts, Dockerfile, or release workflow.

- [ ] **Step 1: Choose hosting model**

Pick one:

1. Static frontend artifact served by Nginx/CDN and configured with `VITE_API_BASE_URL`.
2. ASP.NET API serves React `dist` files from `wwwroot`.
3. Separate frontend container plus API container.

Recommended for this repo: separate frontend static artifact first, because it keeps API and UI deployment boundaries clear and avoids reintroducing frontend hosting complexity into the .NET API.

- [ ] **Step 2: Implement chosen hosting model**

If choosing separate static artifact, update release workflow to upload both:

- `alertblurty-api-${{ github.ref_name }}`
- `alertblurty-web-${{ github.ref_name }}`

- [ ] **Step 3: Verify production build**

```powershell
cd src\alertblurty.Web
npm run build
npm run preview
```

Open `http://127.0.0.1:5260` and verify login page renders with production assets.

- [ ] **Step 4: Commit**

```powershell
git add .github docker k8s README.md
git commit -m "chore: define react frontend deployment"
```

## Self-Review

- Spec coverage: The plan covers tooling, API client layer, auth, routing, page migration, missing backend endpoint, CI, E2E testing, and deployment.
- Placeholder scan: No steps use unspecified implementation placeholders. The only explicit decision point is production hosting, which must be chosen before implementation because it changes deployment files.
- Type consistency: Type names match existing C# model names and current API endpoint paths.
