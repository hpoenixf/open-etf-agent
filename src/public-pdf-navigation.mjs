// Ordinary public viewer navigation is not a general exception for query strings.
// Match the publisher, static PDF path, and exact non-secret menu selector.
export function publicPdfNavigationQuery(url) {
 return url.protocol==='https:' && url.hostname==='www.cnindex.com.cn' &&
  !url.username && !url.password && !url.port &&
  /^\/zh_information\/notices_news\/[0-9]{4}\/[0-9]{6}\/P[0-9]{21}\.pdf$/.test(url.pathname) &&
  url.search==='?act_menu=2' && url.href.endsWith('?act_menu=2');
}
