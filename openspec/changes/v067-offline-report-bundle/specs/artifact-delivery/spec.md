## ADDED Requirements

### Requirement: Portable published report readback

The export command SHALL select a project and Run through existing read-only Publication and Artifact readers. The bundle SHALL contain the complete saved report body and a separate index of recorded public citations, with original numbering and typed locations where available. It SHALL omit private source records and Runtime-generated metadata. An unpublished or unreadable report SHALL produce no bundle.

#### Scenario: Read and check a copied bundle offline

- GIVEN a published report with public and local citations
- WHEN the operator exports the selected Run and copies the bundle
- THEN the body is readable without the original project or a network
- AND the citation index retains public reference numbers and distinguishes extraction chunks from physical page or section
- AND absent public location data stays unknown
- AND a changed member fails offline verification
