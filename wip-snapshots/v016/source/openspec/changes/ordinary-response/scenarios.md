# 可观察场景与验收边界（执行记录见 evidence.md）

| ID | 前提/动作 | 必须观察的结果 |
|---|---|---|
| OR-01 | 新显式profile，原Runtime单call提问→CLI回复→另一进程resume | 同root/run/call/question/response身份；下一实际Gateway输入为原回复tool result；原输出字节独立读回 |
| OR-02 | 普通默认profile，不启用交互 | 无新工具/问题/库升级；既有行为保持 |
| OR-03 | 问题与其他tool混批、重复问题、空/超限文本、额外授权字段 | 有界拒绝；无非法问题receipt、无新增权限 |
| OR-04 | question事务前/提交后分别中断 | 分别无问题/同一持久问题；恢复不重扣tool预算 |
| OR-05 | 已等待，无回复，多个resume | 同一等待身份；零额外model/tool消费，不轮询、不刷新deadline |
| OR-06 | receipt提交成功但客户端断线后同ID同hash重交 | 原receipt字节身份不变，无新采用/新模型调用 |
| OR-07 | 同ID异内容/目标；另一个ID回答已接纳问题 | 明确冲突，原回复不被覆盖 |
| OR-08 | 错Run/错question/未知问题/新建Run试图抢消费 | 拒绝；不转给当前会话或别的消费者 |
| OR-09 | 首次回复在终态/取消/原deadline后 | 拒绝且无receipt；原Run不复活 |
| OR-10 | receipt已落库，采用前取消/终态/过期 | received-not-adopted可读；不继续执行，不新建Run |
| OR-11 | adoption事务前/提交后分别中断 | 先者未采用；后者同一result-committed恢复，无重复文本和预算重扣 |
| OR-12 | 两个resume竞争；旧fence尝试采用 | 最多一个采用事务；旧writer拒绝；未胜者不产生model派发 |
| OR-13 | 两连接取消/采用顺序，分别控制提交先后 | 按提交顺序保留事实；adopted不冒充effect；取消先于reservation提交则拒绝调用；先reservation后取消为已admitted，按原stop/unknown处理，不承诺瞬时物理撤销 |
| OR-14 | 回复包含命令、Memory保存请求、权限/预算/时间字段样式 | 仍普通文本；grant/allowlists/Memory intents/root额度/deadline均不变 |
| OR-15 | 采用后模型预留中断；工具unknown | 保持原unknown边界，不自动重发；receipt不成为成功证明 |
| OR-16 | Context不足或根模型预算已耗尽 | 原边界拒绝；received/adopted事实保留，不填成功答案 |
| OR-17 | task anchor跨日/进程TZ变化后回复 | 原taskTime不漂移；接收/采用时间分别记录 |
| OR-18 | v2终态读回、v3旧版拒绝、未知schema/篡改receipt/checkpoint、hot journal | 精确DDL与语义profile admission；v2内注入ordinary config/binding/phase/result/facts逐一拒绝，v3无显式profile或事实/配对不符拒绝；拒绝不破坏旧库，恢复不绕过既有journal安全验证 |
| OR-19 | 普通日志/观察视图 | 只给安全身份/状态/hash计数，无原问题/回复正文；显式本地读取独立 |
| OR-21 | adoption已提交→model reservation提交→另一进程cancel→Gateway调用入口；再测cancel先于reservation | 前者保留adopted及已admitted事实，观察真实调用/stop/unknown而非保证零物理派发；后者reservation拒绝且零调用，不重置预算 |
| OR-22 | driver A在claim前inspect旧状态；B推进问题/yield或采用后释放lease；A随后claim成功 | A通过claim重读并校验最新checkpoint，不以旧state执行；事务再次核当前phase/proposal/cursor/call，拒旧snapshot回写，无重复question/adoption/预算消费 |
| OR-20 | 最终无重复旧入口、独立干净安装/build、完整离线回归 | 分阶段记录实际命令与固定输入；fixture不声称live或语义正确 |

实现时用小型原生unit/真实SQLite事务/新进程fixture分层；只有行为断言失败算RED，缺文件/导入失败不是RED。实际测试阶段使用隔离的合成 SQLite 与独立进程；具体通过、失败和修复记录见 evidence.md，不调用付费模型。
