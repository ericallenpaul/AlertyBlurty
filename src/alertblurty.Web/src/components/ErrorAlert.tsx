export function ErrorAlert({
  children,
  onRetry,
  title,
}: {
  children: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div className="alert alert-danger" role="alert">
      {title ? <h4 className="alert-heading">{title}</h4> : null}
      <p className="mb-0">{children}</p>
      {onRetry ? (
        <button
          className="btn btn-primary mt-3"
          onClick={onRetry}
          type="button"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
