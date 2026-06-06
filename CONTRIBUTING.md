# Contributing to alertblurty

Thanks for contributing.

## Development setup

1. Install prerequisites:
   - .NET 10 SDK
   - PostgreSQL 15+
2. Clone the repo and restore dependencies:
   - `dotnet restore alertblurty.sln`
3. Run tests locally:
   - `dotnet test alertblurty.sln`

## Branching and pull requests

1. Create a branch from `main`.
2. Keep changes focused and include tests for behavior changes.
3. Ensure local checks pass before opening a PR:
   - `dotnet build alertblurty.sln -c Release`
   - `dotnet format alertblurty.sln --verify-no-changes`
   - `dotnet test alertblurty.sln -c Release`
4. Open a PR that includes:
   - Problem statement
   - Change summary
   - Test evidence

## Commit guidance

- Use clear, imperative commit messages.
- Prefer small commits that are easy to review.

## Code standards

- Follow existing project naming and folder conventions.
- Avoid introducing secrets or credentials in source control.
- Update docs for user-facing or operational changes.
