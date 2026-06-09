import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { getSetupStatus } from "../api/setup";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";

export function HomeRedirect() {
  const { isAuthenticated } = useAuth();
  const [destination, setDestination] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  const checkStatus = useCallback(async () => {
    if (isAuthenticated) {
      setDestination("/dashboard");
      return;
    }

    setHasError(false);
    setDestination(null);

    try {
      const status = await getSetupStatus();
      setDestination(status.hasOrganizations ? "/login" : "/setup");
    } catch {
      setHasError(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void Promise.resolve().then(checkStatus);
  }, [checkStatus]);

  if (destination) {
    return <Navigate to={destination} replace />;
  }

  if (hasError) {
    return (
      <main className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-md-6 text-center">
            <ErrorAlert
              onRetry={() => void checkStatus()}
              title="Connection Error"
            >
              Unable to connect to the API. Please ensure the backend API is
              running on port 5041.
            </ErrorAlert>
          </div>
        </div>
      </main>
    );
  }

  return <LoadingState message="Checking system status..." />;
}
