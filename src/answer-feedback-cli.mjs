import {parseArgs} from 'node:util';
import {answerFeedback} from './answer-feedback.mjs';

const fail = code => { throw Object.assign(new Error(code), {code}); };
const required = {
  identity: ['session', 'run'],
  submit: ['session', 'run', 'revision', 'expected-hash', 'key', 'rating'],
  read: ['session', 'key'],
  withdraw: ['session', 'key']
};
const optional = {identity: ['revision'], submit: ['reason']};
const usage = `Usage:
  node src/answer-feedback-cli.mjs identity --session DIR --run ID [--revision 1..3]
  node src/answer-feedback-cli.mjs submit --session DIR --run ID --revision 1..3 --expected-hash SHA256 --key KEY --rating 1..5 [--reason TEXT]
  node src/answer-feedback-cli.mjs read --session DIR --key KEY
  node src/answer-feedback-cli.mjs withdraw --session DIR --key KEY
`;

const [action, ...args] = process.argv.slice(2);
try {
  if (action === '--help' && args.length === 0) {
    process.stdout.write(usage);
  } else {
    if (!Object.hasOwn(required, action)) fail('INVALID_ARGUMENT');
    const fields = [...required[action], ...(optional[action] ?? [])];
    const {values, tokens} = parseArgs({
      args, options: Object.fromEntries(fields.map(name => [name, {type: 'string'}])), tokens: true
    });
    if (tokens.length !== new Set(tokens.map(token => token.name)).size ||
        !tokens.every(token => token.value && !token.value.includes('\0')) ||
        required[action].some(name => !Object.hasOwn(values, name)) ||
        (values.revision !== undefined && !/^[1-3]$/.test(values.revision)) ||
        (values.rating !== undefined && !/^[1-5]$/.test(values.rating))) fail('INVALID_ARGUMENT');
    const result = await answerFeedback({
      action, session: values.session, runId: values.run, key: values.key, reason: values.reason,
      expectedHash: values['expected-hash'],
      revision: values.revision === undefined ? undefined : Number(values.revision),
      rating: values.rating === undefined ? undefined : Number(values.rating)
    });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }
} catch (error) {
  const code = error.code?.startsWith('ERR_PARSE_ARGS_') ? 'INVALID_ARGUMENT' : error.code;
  process.stderr.write((code ?? 'ANSWER_FEEDBACK_FAILED') + '\n');
  process.exitCode = 2;
}
