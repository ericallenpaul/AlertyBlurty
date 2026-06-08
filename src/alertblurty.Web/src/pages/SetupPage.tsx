import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { hasOrganizations } from "../api/organizations";
import { useAuth } from "../auth/AuthProvider";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { timezones } from "./pageUtils";

export function SetupPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [timezone, setTimezone] = useState("");

  useEffect(() => {
    async function loadSetupStatus() {
      try {
        setSetupComplete(await hasOrganizations());
      } catch {
        setSetupComplete(false);
      } finally {
        setIsLoading(false);
      }
    }

    void loadSetupStatus();
  }, []);

  async function handleCompleteSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateSetup();

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await register({
        organizationName: organizationName.trim(),
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        phoneNumber: phoneNumber.trim(),
        timezone,
      });

      if (!result) {
        setError("Failed to create organization. The API returned no data.");
        return;
      }

      setStep(3);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? `Error: ${submitError.message}`
          : "Error: Failed to create organization.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function validateSetup() {
    if (
      !organizationName.trim() ||
      !fullName.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword ||
      !phoneNumber.trim() ||
      !timezone
    ) {
      return "Please fill in all required fields correctly.";
    }

    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }

    if (password.length < 8) {
      return "Password must be at least 8 characters long.";
    }

    return null;
  }

  if (isLoading) {
    return <LoadingState message="Checking setup status..." />;
  }

  if (setupComplete) {
    return (
      <main className="container mt-4">
        <div className="alert alert-success" role="alert">
          <h1 className="h4 alert-heading">Setup Already Complete!</h1>
          <p>AlertyBlurty is already configured. You can now log in.</p>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/login")}
            type="button"
          >
            Go to Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card shadow">
            <div className="card-header bg-primary text-white">
              <h1 className="h3 mb-0">Welcome to AlertyBlurty</h1>
              <small>Let's get you set up in just a few steps</small>
            </div>
            <div className="card-body">
              <div className="mb-4">
                <div className="progress" style={{ height: 5 }}>
                  <div
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={(step / 3) * 100}
                    className="progress-bar"
                    role="progressbar"
                    style={{ width: `${(step / 3) * 100}%` }}
                  />
                </div>
                <div className="d-flex justify-content-between mt-2 small text-muted">
                  <span className={step >= 1 ? "fw-bold" : ""}>
                    Organization
                  </span>
                  <span className={step >= 2 ? "fw-bold" : ""}>
                    Admin Account
                  </span>
                  <span className={step >= 3 ? "fw-bold" : ""}>Complete</span>
                </div>
              </div>

              {error ? <ErrorAlert>{error}</ErrorAlert> : null}

              {step === 1 ? (
                <section>
                  <h2 className="h4">Step 1: Organization Information</h2>
                  <p className="text-muted">Tell us about your organization</p>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="organizationName">
                      Organization Name *
                    </label>
                    <input
                      className="form-control"
                      id="organizationName"
                      onChange={(event) =>
                        setOrganizationName(event.target.value)
                      }
                      placeholder="e.g., Acme Corporation"
                      value={organizationName}
                    />
                  </div>
                  <div className="d-flex justify-content-end">
                    <button
                      className="btn btn-primary"
                      disabled={!organizationName.trim()}
                      onClick={() => {
                        setError(null);
                        setStep(2);
                      }}
                      type="button"
                    >
                      Next
                    </button>
                  </div>
                </section>
              ) : null}

              {step === 2 ? (
                <form onSubmit={handleCompleteSetup}>
                  <h2 className="h4">Step 2: Create Administrator Account</h2>
                  <p className="text-muted">
                    This will be the first SuperAdmin user
                  </p>
                  <div className="row">
                    <Field
                      id="fullName"
                      label="Full Name *"
                      onChange={setFullName}
                      value={fullName}
                    />
                    <Field
                      id="email"
                      label="Email *"
                      onChange={setEmail}
                      type="email"
                      value={email}
                    />
                  </div>
                  <div className="row">
                    <Field
                      id="password"
                      label="Password *"
                      onChange={setPassword}
                      type="password"
                      value={password}
                    />
                    <Field
                      id="confirmPassword"
                      label="Confirm Password *"
                      onChange={setConfirmPassword}
                      type="password"
                      value={confirmPassword}
                    />
                  </div>
                  <div className="row">
                    <Field
                      id="phoneNumber"
                      label="Phone Number *"
                      onChange={setPhoneNumber}
                      type="tel"
                      value={phoneNumber}
                    />
                    <div className="col-md-6 mb-3">
                      <label className="form-label" htmlFor="timezone">
                        Timezone *
                      </label>
                      <select
                        className="form-select"
                        id="timezone"
                        onChange={(event) => setTimezone(event.target.value)}
                        value={timezone}
                      >
                        <option value="">Select timezone...</option>
                        {timezones.slice(0, 5).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="d-flex justify-content-between gap-2">
                    <button
                      className="btn btn-secondary"
                      onClick={() => setStep(1)}
                      type="button"
                    >
                      Back
                    </button>
                    <button
                      className="btn btn-primary"
                      disabled={isSubmitting}
                      type="submit"
                    >
                      {isSubmitting ? "Creating..." : "Complete Setup"}
                    </button>
                  </div>
                </form>
              ) : null}

              {step === 3 ? (
                <section className="text-center py-4">
                  <h2 className="h4">Setup Complete!</h2>
                  <p className="text-muted">
                    Your AlertyBlurty instance is ready to use.
                  </p>
                  <p>
                    Organization: <strong>{organizationName}</strong>
                  </p>
                  <p>
                    Admin: <strong>{fullName}</strong> ({email})
                  </p>
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={() => navigate("/dashboard")}
                    type="button"
                  >
                    Go to Dashboard
                  </button>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({
  id,
  label,
  onChange,
  type = "text",
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <div className="col-md-6 mb-3">
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <input
        className="form-control"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </div>
  );
}
