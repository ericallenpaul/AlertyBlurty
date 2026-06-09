import { type FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  if (isAuthenticated && !hasSubmitted) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    setHasSubmitted(true);

    try {
      const response = await login({ email, password });

      if (!response) {
        setError("Invalid email or password.");
        return;
      }

      navigate(getPostLoginPath(location.state), { replace: true });
    } catch {
      setError("Invalid email or password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="container py-5">
      <div className="row justify-content-center">
        <div className="col-12 col-sm-10 col-md-7 col-lg-5">
          <div className="auth-logo-panel mb-4">
            <img alt="AlertyBlurty" src="/alerty-blurty-logo.png" />
          </div>
          <h1 className="h3 mb-3">Sign in</h1>
          {error ? (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          ) : null}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label" htmlFor="email">
                Email address
              </label>
              <input
                autoComplete="email"
                className="form-control"
                id="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="your.email@example.com"
                required
                type="email"
                value={email}
              />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <input
                autoComplete="current-password"
                className="form-control"
                id="password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
                type="password"
                value={password}
              />
            </div>
            <button
              className="btn btn-primary"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function getPostLoginPath(state: unknown) {
  if (
    state &&
    typeof state === "object" &&
    "from" in state &&
    state.from &&
    typeof state.from === "object" &&
    "pathname" in state.from &&
    typeof state.from.pathname === "string" &&
    state.from.pathname !== "/login"
  ) {
    const search =
      "search" in state.from && typeof state.from.search === "string"
        ? state.from.search
        : "";
    const hash =
      "hash" in state.from && typeof state.from.hash === "string"
        ? state.from.hash
        : "";

    return `${state.from.pathname}${search}${hash}`;
  }

  return "/dashboard";
}
