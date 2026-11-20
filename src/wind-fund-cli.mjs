import { fetchWindFundDailyClose } from './wind-fund.mjs';

const usage = 'Usage: npm run wind:fund -- <Wind-listed-fund-code> <YYYY-MM-DD> <YYYY-MM-DD>\nAuthorization: supply your own WIND_API_KEY to this process. This performs a real Wind request.\n';
if (process.argv.slice(2).join(' ') === '--help') {
  process.stdout.write(usage);
} else if (process.argv.length !== 5) {
  process.stderr.write(usage);
  process.exitCode = 2;
} else {
  const [, , windCode, beginDate, endDate] = process.argv;
  try {
    const result = await fetchWindFundDailyClose({ windCode, beginDate, endDate }, { apiKey: process.env.WIND_API_KEY });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (error) {
    process.stderr.write((error.code?.startsWith('WIND_FUND_') ? error.code : 'WIND_FUND_FAILED') + '\n');
    process.exitCode = 1;
  }
}
