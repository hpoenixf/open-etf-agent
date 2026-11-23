# Open 0.44 GUI candidate

This slice composes safe Markdown rendering, compact Daily Watch and composer
controls, optional PDF, and native financial chart Skill selection. It does
not change account admission, project isolation, daily email policy, or
public ingress. The authenticated account site remains an offline fixture
by default. This is a source/verification record, not an activation notice.

## Source and evidence boundary

The 0.43 predecessor is `8fc199812cf0ed43a149bc45c583d8c913eb4816`,
root tree `5ee9f3152b8865035228077dd63c8f5d6b39dd21`; the reviewed change
preserves exact tested src tree `1fa0efa5a728384df6519bc6d20d80cbb9812bd4`
after grafting to that predecessor. The initial full test was performed on
the equivalent 0.44 source overlay before this final metadata graft:
Node 26.11.1, 1,658 passed, zero failed and six opted-out tests (actual
Better Auth, mobile browser, four fixed historical binaries). It was not
a combined browser, paid provider, or production-deployment test. Separately,
the isolated 0.43 official optional Better Auth installer was previously
validated; this is not evidence of the 0.44 browser experience.

Committed Markdown is rendered as DOM and never treats raw HTML, remote
images, model-generated JSON fences or ordinary prose as authorized chart
instructions. The only wired data adapter returns Wind daily exchange closes;
it does not treat that series as NAV, OHLC, holdings, or comparable return
data. Other typed renderer shapes use synthetic fixtures. An authorized
original chart can be reproduced only from accepted same-Run evidence.

Before release, verify chosen code and version pins independently, run the
exact candidate checks, and complete isolated desktop/mobile preview. Do not
configure a production URL, live provider credential, account database,
scheduled mail or migration in order to preview this UI.

## Isolated staging API smoke check

An authenticated HTTPS client created an ordinary empty conversation
(HTTP 201) and read the History list and detail (HTTP 200 for each) on the
isolated staging candidate. No model calls were made. This verifies the
basic authenticated HTTP path only.

## Isolated staging browser check

The deployed isolated staging candidate used the same application source
tree above. The [candidate Verify run](https://github.com/hpoenixf/open-etf-agent/actions/runs/45092590146)
passed on the packaged candidate before this documentation update. The
browser check did not exercise production.

- Signed in using the HTML form. From Tools, selected the Financial Chart
  Skill and completed a synthetic fund daily-close question. The answer
  rendered a Markdown heading, list, table, and chart. The chart showed
  two markers and left the missing observation visibly unconnected.
- At a desktop viewport, reloaded the page and reopened the saved
  conversation from History. The completed answer, table, and chart read back.
- At a narrow browser viewport (454 CSS pixels), opened the History drawer
  and reopened the same saved chart. The question and send controls fit
  without root horizontal overflow. This was not a physical phone test.

No external model, Wind, or mail request was made. Actual PDF upload,
other chart formats, physical-device behavior, and production operation
remain outside this browser check.
