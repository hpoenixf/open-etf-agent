## ADDED Requirements

### Requirement: Backend account authorization
The authenticated site SHALL validate server-side session state before every
Project operation and protected asset. The immutable session subject SHALL be
the sole source for selecting a Project. Sign-up SHALL NOT be available by
default, via browser or direct request.

#### Scenario: Request received without an authenticated session
- **WHEN** a caller requests the workbench or any protected app API or asset
- **THEN** the server redirects only the workbench entry to login or rejects the request
- **AND** there is no Project action or data in the response

#### Scenario: Two accounts use the workbench
- **WHEN** a caller supplies a valid session and requests a resource assigned to another account
- **THEN** the server only reads the authenticated subject's Project
- **AND** arbitrary identity and path hints cannot change the Project

### Requirement: Durable, revocable session
The service SHALL use explicit HTTPS origin and host-only secure HttpOnly SameSite
cookies. It SHALL read the backing session without any stale cookie cache and
SHALL NOT claim successful logout without checking the prior session.

#### Scenario: Account signs out
- **WHEN** a currently authenticated user signs out
- **THEN** the prior cookie cannot authorize another protected request
- **AND** other accounts' independent sessions remain valid

#### Scenario: Auth state cannot be verified
- **WHEN** required state is unavailable, migration is pending, or cookie policy cannot be verified
- **THEN** the service fails closed without exposing a Project

### Requirement: Explicit owner migration
The authenticated candidate SHALL NOT use legacy owner data by default or as a
fallback. Existing owner data SHALL remain unchanged until an explicit operator
copy and verified readback, and restoration of the old ingress SHALL be possible.

#### Scenario: Rehearse an owner cutover
- **WHEN** the operator explicitly assigns a cold copy to a verified account
- **THEN** the exact existing History, reports and evidence are verified against the copy
- **AND** an independent account cannot see the copied Project
- **AND** original data and ingress remain available for rollback
