# One local shared capacity group

The unreleased v0.24 Project capacity policy is described separately in [English](provider-capacity.md) and [简体中文](provider-capacity.zh-CN.md). The historical v0.17 scope below is retained.

The v0.17 module wraps the original durable main `gateway.next` entry with one fixed route and one shared slot. The original Runtime `claim.reserve` transaction remains the only RootBudget debit owner. Admission stores capacity identity, not another budget or billing ledger.

## Run the bounded provider-free examples

After the ordinary locked installation and build:

```sh
node src/admission-demo.mjs normal output/admission-demo
node src/admission-demo.mjs unknown output/admission-demo
```

Each command creates an isolated synthetic directory and uses the existing loopback HTTP Gateway. The normal example starts two local calling processes: A owns the slot, B waits, then B dispatches after A's original completion. The unknown example retains A's unknown occupancy while B is queued and then cancelled. These examples do not call an external provider. Inspect the printed `receipt.safe.json` and original ticket identities; do not delete a retained unknown ticket to manufacture spare capacity.

## Safety and recovery boundaries

- A successful original `claim.reserve` return view supplies the Run, model ordinal, fence and exact input hash. Admission does not reconstruct these facts from a later cumulative budget read.
- Session and capacity are separate local SQLite files, not an atomic transaction. A crash between reservation and ticket creation can retain budget without a ticket; the system does not refund or automatically retry.
- Local cancellation before dispatch can cancel a queued ticket without a request. After dispatch, local abort, half-stream failure, process death or missing terminal evidence retains occupancy. Unknown/dispatched tickets have no automatic TTL release.
- Original Gateway branded complete termination is required to settle dispatched capacity. A local timeout is not proof of remote termination. A local fence check cannot recall an already sent request.
- Unsupported compaction callbacks, Child entry and non-durable execution are rejected. This wrapper does not govern arbitrary plugin-owned requests or all requests on an account. No routing, failover, prices, multi-group fairness or external database service is added.

The retained [original proposal](../openspec/changes/v017-shared-admission/proposal.md) describes its historical candidate/WIP stage. New release qualification is separate: offline contention safety and any fixed real-request cohort have different denominators and must not be pooled. Sequential live calls do not establish live concurrent contention.

## 中文

这个模块让两个本地调用进程共享一条固定 route 的一个容量槽。预算仍只由原 Runtime 扣减，Admission 只管容量，不另建计费真相。normal 示例验证排队与交接；unknown 示例保留未知请求占位，不靠 TTL、退款或自动重发制造空位。上述命令均为隔离合成案例，不调用外部模型。真实顺序调用与离线双进程竞争必须分别保留证据，不能合并计分或声称验证了 live 并发。
