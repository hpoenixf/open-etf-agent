# One explicitly confirmed Schedule Occurrence

This module turns one confirmed future synthetic task into an original Session Run. The existing Worker, optional original Admission, Publication and Artifact Reader keep their responsibilities. It does not install a daemon, wake itself, add cron/recurrence or create another executor.

## Provider-free CLI example

After locked installation/build, select an explicit future instant and a separate session directory:

```sh
INSTANT="$(node -e 'console.log(new Date(Date.now()+60000).toISOString())')"
node src/session-cli.mjs schedule-confirm --session runs/schedule-demo --schedule one-shot --revision 1 --instant "$INSTANT" --zone Asia/Shanghai --lateness 60000
```

Copy the returned `reference.confirmationHash`. This command only confirms; it does not run in the background. At the selected instant, explicitly invoke:

```sh
node src/session-cli.mjs schedule-wake --session runs/schedule-demo --schedule one-shot --hash CONFIRMATION_HASH
node src/session-cli.mjs schedule-inspect --session runs/schedule-demo --schedule one-shot --hash CONFIRMATION_HASH
node src/session-cli.mjs schedule-publication --session runs/schedule-demo --schedule one-shot --hash CONFIRMATION_HASH
```

Replace `CONFIRMATION_HASH` with the actual returned value. An early invocation is not an instruction to wait or spawn a scheduler. Repeating a committed occurrence reuses its original linked Run rather than inventing another task. A missed first materialization is not silently moved to a new instant. The shipped recipe is fixture-only; it is not a live-provider CLI or blanket authorization to call a model.

## Scope and recovery

- Explicit opt-in `schedule-occurrence@1` / Session schema5; existing schema2/3/4 directories are not silently upgraded.
- Atomic original Run creation/linking, confirmed identity, fixed TaskTime and existing Run deadline. Cancellation/revocation preserves the original linked Run, spent budget and unknown facts.
- The original Worker still owns leases, stop/restart and unknown effects. Admission remains a separate original capacity owner.
- Existing committed-state restart, two-process duplicate materialization, serialized cancellation orders and original Publication/Reader have bounded evidence. They do not prove schema5 hot-journal power-loss recovery, simultaneous cancellation/wake stress, arbitrary external-input compatibility or overnight autonomous wake.
- No arbitrary protected/ordinary/Child/Memory/PDF combinations are added. An unused empty directory can remain after a crash/cancel before admission; it is not a new Run or authority grant.

## Explicit historical-opener check

Ordinary `npm test` is self-contained and checks the current legacy profiles. The separate command below verifies an actual fixed old implementation, not a same-version fallback:

```sh
git clone https://github.com/hpoenixf/open-etf-agent.git ../open-etf-agent-v016
git -C ../open-etf-agent-v016 checkout --detach 35f244f2e06da447c110325d2ac5a5c39f36e842
(cd ../open-etf-agent-v016 && npm ci --ignore-scripts --no-audit --no-fund)
node scripts/check-schedule-historical-opener.mjs --source-root ../open-etf-agent-v016
```

Before importing that opener, the checker verifies its fixed public receipt and every declared executable/fixture/package input. It does not download or execute a floating branch. The two checks have distinct names and receipts. The original environment-dependent test failure and older 32-case WIP evidence remain historical observations, not newly relabeled passes.

## 中文

一次确认只建立一个明确时点、时区和身份的 occurrence；到时须显式再次调用原 Worker。没有后台服务、自动唤醒或周期任务。默认 CLI 是 fixture，不是 live 模型入口。schema5 显式 opt-in，不迁移旧目录。普通测试验证当前 legacy profiles；独立脚本按公开固定 v0.16 receipt 校验全部源码输入后才导入真实旧 opener，两种证据不能互换。
