# Contributing

Thanks for helping. The most useful contributions are:

1. **A faster version of a stack you know well.** I'm not an expert in all 33 of these. If a stack is slow because of
   something non-idiomatic, a fix is very welcome.
2. **A new stack** that renders the same site.
3. **Reruns on other hardware**, especially a real $12 droplet, so the absolute numbers can be checked.
4. **Corrections** to the report, the RESULTS notes, or the method.

Please open an issue before a large change, so we can agree on the approach first.

## Ground rules for a fair comparison

Every stack does the same useful work, and only the renderer differs. A change is accepted when it keeps that true.

- **Same app.** Follow [`frontends/SPEC.md`](frontends/SPEC.md): the same routes, the same API calls, the same markup
  and `frontends/shared/styles.css`, and the same JSON passthrough routes the load test uses for writes.
- **No caching** of pages or API data, unless the variant is explicitly a caching variant (its name says so).
  Every page request calls the API and renders fresh data.
- **Production defaults.** Build for production and run the framework the way its docs recommend deploying it. If you
  turn a default off (gzip, CSRF, logging), say so in the stack's README and why.
- **One fix per tuned variant.** Improvements to an existing stack go into a new `<stack>-tuned` folder, and the
  original stays on the leaderboard. The README of the tuned folder names the profiled cost and the change.
- **Idiomatic code.** A fix should be something a normal team would ship: a config flag, moving work out of a
  hot path, a better-suited API. Not hand-written HTTP parsing or skipping escaping.

## Adding a stack

1. Create `frontends/<name>/` with:
   - a `Dockerfile` that builds the app and starts one production server on `0.0.0.0:3000`, with a healthcheck;
   - a `README.md`: versions, how it renders, anything that differs from the spec or the defaults, and how to run it.
2. Read `BACKEND_URL` (and `JWT_SECRET` if you sign demo tokens) from the environment, as the spec describes.
3. Check it renders the same pages as the reference (`frontends/nextjs`): compare the feed and a post page side by side,
   and make sure login, likes and new posts work.
4. Smoke-test it in the simulation:

   ```bash
   export CPUS=0.4
   FRONTEND=<name> bash sim/sim.sh up
   FRONTEND=<name> bash sim/sim.sh run 1000 2m
   bash sim/sim.sh down
   ```

5. If you have a machine to spare, run the full search with `bash sim/step-search.sh <name>` and include the
   `SCORE` line from `sim/results/runs.log` in the PR. Otherwise say so, and the score can be run before merging.

## Reporting results from other hardware

Open an issue with the **Benchmark result** template: CPU model, `CPUS`, how you pinned the cores, the stack, and the
`sim/results/<run>/summary.json` of the passing 5-minute hold. Numbers from a different CPU are not mixed into the main
leaderboard, but they are very useful for checking that the ranking holds.

## Pull requests

- Keep a PR to one stack or one topic.
- Don't commit build outputs, `node_modules`, databases or recordings; `.gitignore` covers the usual ones.
- If you change a score, the method, or a number in the report, update `RESULTS.md` and rebuild the report with
  `python3 report/build.py`.
- Describe what you measured and on what machine.

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE), and that you follow
the [Code of Conduct](CODE_OF_CONDUCT.md).
