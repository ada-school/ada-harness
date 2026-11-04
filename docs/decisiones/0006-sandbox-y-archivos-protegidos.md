# 0006. Tools do not leave the workspace and do not touch secrets

**Status:** accepted, October 2026.

## Context

The model proposes paths and the harness runs them. A review found three ways to escape: a neighboring folder with the same prefix (`workspace-otro`), reading `/.env` from the repo root, and `write_memory` with `../`. Also, everything the agent reads travels to the model's provider: reading a `.env` is sending it.

## Decision

- `inside(base, path)` compares folders with `path.relative`, not text prefixes. It rejects `..`, absolute paths, and neighboring folders. The source is `harness/tools/index.ts`. Node runs `dist/harness/tools/index.js`.
- After the lexical path, every existing segment is checked with `lstat`: a symbolic link is rejected, even if it points back inside. This does not cover a concurrent change between the check and the write.
- Paths that start with `/` are read from the repo root. The rest are read from the workspace.
- No segment of a path may be named `.env`, `.env.*`, `.git`, or `.sessions`, neither for reading nor for writing, in the repo or in the workspace (`isProtected()` in `src/config.ts`; Node runs `dist/src/config.js`). This matters when `ADA_WORKSPACE` points at a real project. `.sessions` is the chat history on disk, and a tool must not send it to the model.
- `write_memory` writes only inside the memory folder (`areas/`), and it does not accept protected names there either.
- `run_command` runs with no shell, inside the workspace, with a 60-second limit. On macOS it also runs under Seatbelt (`sandbox-exec`). The process may read and write the workspace, and it may read the system libraries and its own install prefix (so the host `node` can start). It may not read `/Users`, temporary directories, or `/Volumes`, and it may not write outside the workspace. A `.env` next to the workspace is out of reach. Linux is still the directory and the timeout: a container cannot run the host binary, and the tests do not start a daemon.
- `web_fetch` only goes out to the internet: http or https, and it rejects every host that resolves to this machine or to the internal network (loopback, private ranges, cloud metadata), including through redirects. A page it reads cannot lead the agent to your router or to a local API.
- The server serves only `app/` and `docs/`, listens only on this machine (`127.0.0.1`; `ADA_HOST` opens it on purpose and says so at startup), and the API accepts only requests from the chat itself: POST with `application/json`, a local host, and, if the browser sends `Origin`, the server's own. Without this, any page open in the browser could POST to localhost and run tools on this machine.

## Consequences

- A bad path comes back to the model as text ("Archivo protegido", "Ruta fuera de"), and it can correct course. Those error strings are still Spanish.
- On macOS, a program the agent runs cannot read the home directory or write outside the workspace. It can still read system paths (`/usr`, `/opt`, `/etc`), because the dynamic linker needs them. On Linux the process can still read whatever the user can read.

## Checked by

`tests/unit/tools.test.js`, `tests/unit/http-cli.test.js`, and the "seguridad" test in `tests/integration/server.test.js`. Each known escape has its test, and each test was checked by breaking the code on purpose.

## When to revisit

When Linux needs the same wall, wire bubblewrap with these rules and run the outside-file test there. A container is the step after that, and only if the command must run without the host's binaries.
