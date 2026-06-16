import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { bootstrapSetup, getSetupStatus } from "../api/setup";
import { useAuth } from "../auth/AuthProvider";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import type { DatabaseSetupMode, PostgresSslMode } from "../types/api";
import { timezones } from "./pageUtils";

type SetupStep = 1 | 2 | 3 | 4;

export function SetupPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<SetupStep>(1);
  const [error, setError] = useState<string | null>(null);
  const [jwtConfigured, setJwtConfigured] = useState(false);
  const [databaseMode, setDatabaseMode] =
    useState<DatabaseSetupMode>("BundledDocker");
  const [databaseServer, setDatabaseServer] = useState("postgres");
  const [databasePort, setDatabasePort] = useState("5432");
  const [databaseName, setDatabaseName] = useState("alertyblurty");
  const [databaseUsername, setDatabaseUsername] = useState("alerty_app");
  const [databasePassword, setDatabasePassword] = useState("");
  const [databaseSslMode, setDatabaseSslMode] =
    useState<PostgresSslMode>("Disable");
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState("");
  const [jwtSecret, setJwtSecret] = useState("");
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
        const status = await getSetupStatus();
        setJwtConfigured(status.jwtConfigured);
        setSetupComplete(status.hasOrganizations);

        if (
          !status.hasOrganizations &&
          status.databaseConfigured &&
          status.databaseReachable &&
          status.twilioConfigured &&
          status.jwtConfigured
        ) {
          setStep(2);
        }
      } catch {
        setSetupComplete(false);
      } finally {
        setIsLoading(false);
      }
    }

    void loadSetupStatus();
  }, []);

  async function handleBootstrapSystem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateSystemConfiguration();

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const database =
        databaseMode === "BundledDocker"
          ? {
              mode: databaseMode,
              server: "postgres",
              port: 5432,
              databaseName: "alertyblurty",
              username: "alerty_app",
              password: databasePassword,
              sslMode: "Disable" as PostgresSslMode,
            }
          : {
              mode: databaseMode,
              server: databaseServer.trim(),
              port: Number(databasePort),
              databaseName: databaseName.trim(),
              username: databaseUsername.trim(),
              password: databasePassword,
              sslMode: databaseSslMode,
            };

      await bootstrapSetup({
        database,
        twilio: {
          accountSid: twilioAccountSid.trim(),
          authToken: twilioAuthToken,
          phoneNumber: twilioPhoneNumber.trim(),
        },
        jwtSecret: jwtConfigured ? undefined : jwtSecret,
      });

      setJwtConfigured(true);
      setStep(2);
    } catch (submitError) {
      setError(
        getErrorMessage(submitError, "Failed to save system configuration."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCompleteSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateAdminAccount();

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

      setStep(4);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Failed to create organization."));
    } finally {
      setIsSubmitting(false);
    }
  }

  function validateSystemConfiguration() {
    if (
      (databaseMode === "ExternalPostgres" &&
        (!databaseServer.trim() ||
          !databasePort.trim() ||
          !databaseName.trim() ||
          !databaseUsername.trim())) ||
      !databasePassword ||
      !twilioAccountSid.trim() ||
      !twilioAuthToken ||
      !twilioPhoneNumber.trim()
    ) {
      return "Please fill in all system configuration fields.";
    }

    const parsedPort =
      databaseMode === "BundledDocker" ? 5432 : Number(databasePort);
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      return "Database port must be between 1 and 65535.";
    }

    if (!jwtConfigured && jwtSecret.trim().length < 32) {
      return "JWT secret must be at least 32 characters long.";
    }

    return null;
  }

  function handleDatabaseModeChange(mode: DatabaseSetupMode) {
    setDatabaseMode(mode);

    if (mode === "BundledDocker") {
      setDatabaseServer("postgres");
      setDatabasePort("5432");
      setDatabaseName("alertyblurty");
      setDatabaseUsername("alerty_app");
      setDatabaseSslMode("Disable");
      return;
    }

    setDatabaseSslMode("Prefer");
  }

  function validateAdminAccount() {
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
          <h1 className="h4 alert-heading">Setup Already Complete</h1>
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
    <main className="setup-page container py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-9">
          <div className="card setup-card shadow">
            <div className="card-header setup-card-header">
              <img
                alt="AlertyBlurty"
                className="setup-logo"
                src="/alerty-blurty-logo.png"
              />
            </div>
            <div className="card-body">
              <div className="mb-4">
                <div className="progress" style={{ height: 6 }}>
                  <div
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={(step / 4) * 100}
                    className="progress-bar"
                    role="progressbar"
                    style={{ width: `${(step / 4) * 100}%` }}
                  />
                </div>
                <div className="setup-steps mt-2 small">
                  <span className={step >= 1 ? "active" : ""}>System</span>
                  <span className={step >= 2 ? "active" : ""}>
                    Organization
                  </span>
                  <span className={step >= 3 ? "active" : ""}>Admin</span>
                  <span className={step >= 4 ? "active" : ""}>Complete</span>
                </div>
              </div>

              {error ? <ErrorAlert>{error}</ErrorAlert> : null}

              {step === 1 ? (
                <form onSubmit={handleBootstrapSystem}>
                  <h1 className="h4">System Configuration</h1>
                  <p className="text-muted">
                    Connect AlertyBlurty to a blank PostgreSQL database and SMS
                    provider.
                  </p>
                  <h2 className="h5 mt-4">Database</h2>
                  <div className="mb-3">
                    <div className="form-label">Database Mode *</div>
                    <div className="database-mode-options">
                      <label className="form-check">
                        <input
                          checked={databaseMode === "BundledDocker"}
                          className="form-check-input"
                          name="databaseMode"
                          onChange={() =>
                            handleDatabaseModeChange("BundledDocker")
                          }
                          type="radio"
                        />
                        <span className="form-check-label">
                          Bundled Docker PostgreSQL
                        </span>
                      </label>
                      <label className="form-check">
                        <input
                          checked={databaseMode === "ExternalPostgres"}
                          className="form-check-input"
                          name="databaseMode"
                          onChange={() =>
                            handleDatabaseModeChange("ExternalPostgres")
                          }
                          type="radio"
                        />
                        <span className="form-check-label">
                          Existing PostgreSQL server
                        </span>
                      </label>
                    </div>
                    {databaseMode === "BundledDocker" ? (
                      <div className="form-text">
                        Bundled Docker uses the Compose service name{" "}
                        <code>postgres</code> on internal port <code>5432</code>
                        . Host port mappings are not used for app-to-database
                        traffic. The password you enter below becomes the
                        application database password during first-run setup.
                      </div>
                    ) : null}
                  </div>
                  <div className="row">
                    <Field
                      id="databaseServer"
                      label="Server *"
                      disabled={databaseMode === "BundledDocker"}
                      onChange={setDatabaseServer}
                      placeholder="postgres"
                      value={databaseServer}
                    />
                    <Field
                      id="databasePort"
                      label="Port *"
                      disabled={databaseMode === "BundledDocker"}
                      onChange={setDatabasePort}
                      placeholder="5432"
                      type="number"
                      value={databasePort}
                    />
                  </div>
                  <div className="row">
                    <Field
                      id="databaseName"
                      label="Database Name *"
                      disabled={databaseMode === "BundledDocker"}
                      onChange={setDatabaseName}
                      placeholder="alertyblurty"
                      value={databaseName}
                    />
                    <Field
                      id="databaseUsername"
                      label="Username *"
                      disabled={databaseMode === "BundledDocker"}
                      onChange={setDatabaseUsername}
                      placeholder="alerty_app"
                      value={databaseUsername}
                    />
                  </div>
                  <div className="row">
                    <PasswordField
                      id="databasePassword"
                      label="Password *"
                      onChange={setDatabasePassword}
                      placeholder="PostgreSQL password"
                      value={databasePassword}
                    />
                    {databaseMode === "ExternalPostgres" ? (
                      <div className="col-md-6 mb-3">
                        <label className="form-label" htmlFor="databaseSslMode">
                          SSL Mode *
                        </label>
                        <select
                          className="form-select"
                          id="databaseSslMode"
                          onChange={(event) =>
                            setDatabaseSslMode(
                              event.target.value as PostgresSslMode,
                            )
                          }
                          value={databaseSslMode}
                        >
                          <option value="Disable">Disable</option>
                          <option value="Prefer">Prefer</option>
                          <option value="Require">Require</option>
                        </select>
                      </div>
                    ) : null}
                    {!jwtConfigured ? (
                      <PasswordField
                        id="jwtSecret"
                        label="JWT Secret *"
                        onChange={setJwtSecret}
                        placeholder="At least 32 characters"
                        tooltip="JWT Secret signs login tokens and must be at least 32 characters."
                        value={jwtSecret}
                      />
                    ) : (
                      <ConfiguredFieldStatus
                        label="JWT Secret"
                        message="Configured from environment or saved setup."
                      />
                    )}
                  </div>
                  <h2 className="h5 mt-4">Twilio</h2>
                  <div className="row">
                    <Field
                      id="twilioAccountSid"
                      label="Account SID *"
                      onChange={setTwilioAccountSid}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={twilioAccountSid}
                    />
                    <PasswordField
                      id="twilioAuthToken"
                      label="Auth Token *"
                      onChange={setTwilioAuthToken}
                      placeholder="Twilio auth token"
                      value={twilioAuthToken}
                    />
                  </div>
                  <div className="row">
                    <Field
                      id="twilioPhoneNumber"
                      label="Phone Number *"
                      onChange={setTwilioPhoneNumber}
                      placeholder="+15551234567"
                      type="tel"
                      value={twilioPhoneNumber}
                    />
                  </div>
                  <div className="d-flex justify-content-end">
                    <button
                      className="btn btn-primary"
                      disabled={isSubmitting}
                      type="submit"
                    >
                      {isSubmitting ? "Initializing..." : "Initialize Database"}
                    </button>
                  </div>
                </form>
              ) : null}

              {step === 2 ? (
                <section>
                  <h1 className="h4">Organization Information</h1>
                  <p className="text-muted">Create the first organization.</p>
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
                      disabled={!organizationName.trim()}
                      onClick={() => {
                        setError(null);
                        setStep(3);
                      }}
                      type="button"
                    >
                      Next
                    </button>
                  </div>
                </section>
              ) : null}

              {step === 3 ? (
                <form onSubmit={handleCompleteSetup}>
                  <h1 className="h4">Create Administrator Account</h1>
                  <p className="text-muted">
                    This will be the first Admin user.
                  </p>
                  <div className="row">
                    <Field
                      id="fullName"
                      label="Full Name *"
                      onChange={setFullName}
                      placeholder="Jane Smith"
                      value={fullName}
                    />
                    <Field
                      id="email"
                      label="Email *"
                      onChange={setEmail}
                      placeholder="jane@example.com"
                      type="email"
                      value={email}
                    />
                  </div>
                  <div className="row">
                    <PasswordField
                      id="password"
                      label="Password *"
                      onChange={setPassword}
                      placeholder="At least 8 characters"
                      value={password}
                    />
                    <PasswordField
                      id="confirmPassword"
                      label="Confirm Password *"
                      onChange={setConfirmPassword}
                      placeholder="Re-enter password"
                      value={confirmPassword}
                    />
                  </div>
                  <div className="row">
                    <Field
                      id="phoneNumber"
                      label="Phone Number *"
                      onChange={setPhoneNumber}
                      placeholder="+15551234567"
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
                      onClick={() => setStep(2)}
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

              {step === 4 ? (
                <section className="text-center py-4">
                  <h1 className="h4">Setup Complete</h1>
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
  disabled = false,
  id,
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  disabled?: boolean;
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
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
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return `Error: ${error.response.data.message}`;
  }

  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }

  return `Error: ${fallback}`;
}

function ConfiguredFieldStatus({
  label,
  message,
}: {
  label: string;
  message: string;
}) {
  return (
    <div className="col-md-6 mb-3">
      <div className="form-label">{label}</div>
      <div className="form-control configured-field-status" role="status">
        <i aria-hidden="true" className="bi bi-check-circle-fill me-2" />
        {message}
      </div>
    </div>
  );
}

function PasswordField({
  id,
  label,
  onChange,
  placeholder,
  tooltip,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  tooltip?: string;
  value: string;
}) {
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <div className="col-md-6 mb-3">
      <label className="form-label" htmlFor={id}>
        {label}
        {tooltip ? (
          <span className="ms-2" title={tooltip}>
            <i aria-hidden="true" className="bi bi-info-circle" />
            <span className="visually-hidden">{tooltip}</span>
          </span>
        ) : null}
      </label>
      <div className="input-group">
        <input
          className="form-control"
          id={id}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={isRevealed ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={isRevealed ? "Hide password" : "Show password"}
          className="btn btn-outline-secondary"
          onClick={() => setIsRevealed((current) => !current)}
          type="button"
        >
          <i
            aria-hidden="true"
            className={isRevealed ? "bi bi-eye-slash" : "bi bi-eye"}
          />
        </button>
      </div>
    </div>
  );
}
