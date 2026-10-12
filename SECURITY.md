# Security

This repository is a benchmark, not software meant for production. Every app in it is a demo built to be measured.

- The keys and secrets in the code (`JWT_SECRET=twelve-dollar-challenge`, Laravel's `APP_KEY`, Phoenix's fallback
  `SECRET_KEY_BASE`) are public, benchmark-only values. They are there so every container starts the same way with no
  setup. Don't reuse them, and don't deploy these apps on the open internet as they are.
- Login on the demo sites takes a seeded user and signs a token without a password check, on purpose.

If you find a real vulnerability, for example in a script that runs on the benchmark host or in a dependency that
affects people running the benchmark, please report it privately through
[GitHub's private vulnerability reporting](https://github.com/indicozy/twelve-dollar-frontend/security/advisories/new)
rather than in a public issue.
