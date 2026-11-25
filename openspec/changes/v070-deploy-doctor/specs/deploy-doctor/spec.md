## ADDED Requirements

### Requirement: Local read-only operator diagnosis

The command SHALL return versioned JSON or text with a distinct check and remediation for installation, Runtime, configuration, directory access and local service readiness. Missing optional service configuration SHALL NOT fail the diagnosis. The CLI SHALL inspect configuration without returning its values and only probe a user-selected loopback port, without following redirects or consuming any response body.

#### Scenario: Distinguish first install, unhealthy service and version mismatch

- GIVEN a fresh installation and a selected empty project directory
- WHEN diagnostics run with no requested service probe
- THEN the output distinguishes initial project setup and optional checks from failures
- AND a requested but unreachable local port or a requested version that differs SHALL be distinguishable from configuration and permission findings
