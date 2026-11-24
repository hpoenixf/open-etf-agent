# v0.50.0 candidate: Daily Brief and complete scheduled email

## Scope and boundaries

Daily Brief is an opt-in Skill for the existing owner Daily Watch scheduler. Its morning and evening windows are explicit in Beijing time. It preserves the original question and canonical stored answer.

The owner may choose complete original reports in one daily digest, or enable two separate full per-Watch messages with separate consent. These modes are mutually exclusive. The default email remains off; when digest is enabled, links only remains the default content unless explicitly changed. Final Markdown is reused unchanged in the text alternative and rendered as safe HTML; the sender does not ask a model again. Old accepted or ambiguous sends are not replayed.

## Evidence

- Open v0.49.0 base: `ca0e3b93b5f94d2c021ec771136067149c077b0c`.
- [Exact candidate PR #36](https://github.com/hpoenixf/open-etf-agent/pull/36): `21e72c1a2864854aeacdc4589c13b9f7ecd600f3`. [Full hosted Verify](https://github.com/hpoenixf/open-etf-agent/actions/runs/45386839520) passed. Local build plus 39 focused provider-free tests passed.
- Authenticated Stage browser verification of the exact 19-file candidate passed in an isolated synthetic Project. The per-Watch mode showed complete-body wording and only a masked recipient, hid digest controls, and persisted consent for a disabled 09:00 watch after reload. Full-digest mode explained one email with complete reports and status only for incomplete items, showed only a masked recipient, and hid individual consent. Neither browser check started a model, schedule, or send. Links-only and off modes were checked by local API only.
- The separate Stage native-timer fixture covered distinct morning and evening occurrences with complete multipart mail through a loopback TLS recorder and no external delivery.
- SMTP fixture uses a loopback TLS recorder with synthetic input, not a production relay. It verifies complete multipart mail and original output integrity without live model calls or external sends. Release qualification and deployment are separate from this evidence; this document does not infer inbox delivery or production configuration.

## 中文

本版将早晚报 Skill 与既有每日追踪连接。早报和晚报使用北京时间明确分窗，保留原始问题及已保存的正文。可以选择每日一封完整摘要，或分别接收两条独立追踪的完整邮件，两种模式互斥，均须明确授权。邮件不再执行一次研究；旧有已接受或状态未知的投递不重发。真实生产邮件接入及实际收件不由本地 SMTP 记录器证明。
