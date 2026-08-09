# Phase 3 Grok audit disposition

Audit configuration: Grok 4.5, high reasoning, subscription-backed CLI, read-only review against `origin/main`.

| Severity | Finding | Decision | Verified fix |
| --- | --- | --- | --- |
| High | The circuit breaker reset when `stop()` changed the public state from `circuit-open` to `stopped`. | Accepted | A separate sticky circuit flag now blocks every restart for this supervisor instance, including after `stop()`. A new instance, created by the next app launch, resets it. |
| Medium | The reserved port was released before spawn with no retry for the bind race. | Accepted | Startup now makes at most three fresh port attempts inside one 120-second deadline. Each failed attempt removes its child and private key directory before the next reservation. The private API key still prevents an unrelated listener from serving a valid completion. |
| Medium | Raw child output could contain prompt or dialogue text. | Accepted | The supervisor drains and discards child stdout and stderr. It retains only bounded, path-redacted Node process errors. A test writes private dialogue to both streams and proves it is absent. |
| Medium | The parent-death smoke could leak Electron and llama-server if setup failed. | Accepted | The probe now uses `finally` to kill Electron and every scoped model process after success or failure. Child-exit waits are bounded. |
| Medium | The packaged smoke did not test crash, restart, circuit, and fallback behavior. | Accepted | The packaged smoke now sends three real fault signals, proves two restarts, proves the circuit opens, proves authored fallback, proves the circuit stays open after `stop()`, and then checks for leaked processes. |

All five findings were reproduced from the reviewed code. No finding was rejected.
