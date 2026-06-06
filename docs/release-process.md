# Release Process

This project uses SemVer tags (`vMAJOR.MINOR.PATCH`) and GitHub Actions for CI and release publishing.

## Preconditions

1. `main` is green in CI.
2. Required docs are up to date (`README.md`, `SECURITY.md`, and release notes).
3. QA sign-off is captured in the related tracking issue.

## Steps for a tagged release

1. Create/update release notes in `docs/` (for example, `docs/release-notes-v0.1.0.md`).
2. Pull latest `main` and create an annotated tag:
   - `git checkout main`
   - `git pull --ff-only`
   - `git tag -a v0.1.0 -m "Release v0.1.0"`
3. Push tag:
   - `git push origin v0.1.0`
4. GitHub Action `.github/workflows/release.yml` runs automatically:
   - builds and tests
   - publishes API artifacts
   - creates a GitHub Release

## Rollback

If a release is bad:

1. Mark the GitHub release as superseded.
2. Tag and ship a patch release (`vX.Y.Z+1`) with the fix.
