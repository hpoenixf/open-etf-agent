import { lexer } from './vendor/marked-16.4.2.mjs';

// Markdown is untrusted. Tokenize, then construct only the DOM elements below.
const add = (parent, text) => parent.append(parent.ownerDocument.createTextNode(text ?? ''));
const el = (parent, tag, value) => {
  const node = parent.ownerDocument.createElement(tag);
  if (value !== undefined) add(node, value);
  parent.append(node);
  return node;
};
function linkTarget(raw) {
  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}
function renderTokens(parent, tokens, depth = 0) {
  for (const token of tokens ?? []) {
    if (depth > 32) { add(parent, token.raw ?? token.text); continue; }
    const inside = node => token.tokens?.length ? renderTokens(node, token.tokens, depth + 1) : add(node, token.text);
    switch (token.type) {
      case 'space': break;
      case 'heading': inside(el(parent, 'h' + Math.max(2, Math.min(6, token.depth)))); break;
      case 'paragraph': inside(el(parent, 'p')); break;
      case 'blockquote': inside(el(parent, 'blockquote')); break;
      case 'strong': inside(el(parent, 'strong')); break;
      case 'em': inside(el(parent, 'em')); break;
      case 'del': inside(el(parent, 'del')); break;
      case 'codespan': el(parent, 'code', token.text); break;
      case 'code': el(el(parent, 'pre'), 'code', token.text); break;
      case 'hr': el(parent, 'hr'); break;
      case 'br': el(parent, 'br'); break;
      case 'link': {
        const href = linkTarget(token.href);
        if (!href) { inside(parent); break; }
        const node = el(parent, 'a'); node.href = href; node.target = '_blank'; node.rel = 'noopener noreferrer';
        inside(node); break;
      }
      case 'image': add(parent, token.text); break; // Do not load remote tracking pixels.
      case 'list': {
        const node = el(parent, token.ordered ? 'ol' : 'ul');
        if (token.ordered && Number.isSafeInteger(token.start) && token.start > 0) node.start = token.start;
        for (const item of token.items) {
          const row = el(node, 'li');
          if (item.task) add(row, item.checked ? '☑ ' : '☐ ');
          renderTokens(row, item.tokens, depth + 1);
        }
        break;
      }
      case 'checkbox': break; // The accessible text marker is already rendered above.
      case 'table': {
        const wrap = el(parent, 'div'); wrap.className = 'markdown-table'; wrap.tabIndex = 0;
        wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', '表格，可横向滚动');
        const table = el(wrap, 'table');
        const row = (section, cells, tag) => {
          const line = el(section, 'tr');
          for (const cell of cells) {
            const item = el(line, tag);
            if (tag === 'th') item.scope = 'col';
            renderTokens(item, cell.tokens, depth + 1);
          }
        };
        row(el(table, 'thead'), token.header, 'th');
        const body = el(table, 'tbody');
        for (const cells of token.rows) row(body, cells, 'td');
        break;
      }
      case 'text': case 'escape': inside(parent); break;
      default: add(parent, token.raw ?? token.text);
    }
  }
}
export function renderMarkdown(doc, value) {
  const node = doc.createElement('div');
  node.className = 'markdown-body';
  const text = String(value ?? '');
  // Workbench's plain-text fallback is lossless for oversized or invalid input.
  if (text.length > 160_000) { el(node, 'pre', text); return node; }
  try { renderTokens(node, lexer(text, { gfm: true })); }
  catch { node.replaceChildren(); el(node, 'pre', text); }
  return node;
}
