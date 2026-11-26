# v1.0.2 candidate verification scope

[简体中文](v102-release.zh-CN.md)

[Fixed source baseline](https://github.com/hpoenixf/open-etf-agent/tree/1cb6999716858f71d77f916e7e210a3af4fa2d31). This candidate adds environment-separated Jaeger observation, inline source links in saved chat answers, and watermarked PNG export with larger type. The CLI remains the public evaluation entry point; the private evaluation workbench is not shipped.

- Node 26.11.1: 26 provider-free checks passed on the corresponding public source candidate. On the Stage-shaped integration, 32 focused checks and 15 offline/synthetic entry checks passed; the built GUI served the exact larger-type module.
- The previously rolled-out GUI hotfix was tested in hosted browsers against a clickable public source and actual downloaded PNGs. The application stores the original answer independently of the presentation.
- A separately isolated hosted runtime emitted a Stage-labelled trace with confirmed answer readback to the host collector. This does not attest to production-labelled live tracing.
- The v1.0.1 real CLI qualification stays attached to its original Runtime source. The v1.0.2 candidate has no new paid test or hosted deployment claim.
