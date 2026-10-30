import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const files = ['README.md', 'README.zh-CN.md', 'docs/module-guide.md', 'docs/module-guide.zh-CN.md']
const documents = new Map(files.map(path => [path, readFileSync(resolve(root, path), 'utf8')]))
function anchors(source) {
  const ids = new Set([...source.matchAll(/<a\s+id="([^"]+)"\s*>/g)].map(match => match[1]))
  const counts = new Map()
  const prose = source.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '')
  for (const match of prose.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const slug = match[1].toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/\s/g, '-')
    const count = counts.get(slug) || 0
    ids.add(count ? `${slug}-${count}` : slug)
    counts.set(slug, count + 1)
  }
  return ids
}
function localLinks(source, file) {
  const hrefs = [...source.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)|\bhref="([^"]+)"/g)].map(m => m[1] || m[2])
  return hrefs.filter(href => !/^(?:[a-z]+:|\/\/)/i.test(href)).map(href => {
    const [path, fragment] = href.split('#')
    return { file: relative(root, resolve(dirname(resolve(root, file)), path || file.split('/').at(-1))), fragment: fragment ? decodeURIComponent(fragment) : null }
  })
}
test('all local README and module-guide links exist and Markdown fragments resolve in both languages', () => {
  let checked = 0
  for (const [file, source] of documents) {
    const explicitIds = [...source.matchAll(/<a\s+id="([^"]+)"\s*>/g)].map(match => match[1])
    assert.equal(new Set(explicitIds).size, explicitIds.length, `${file}: duplicate explicit anchor IDs`)
    for (const link of localLinks(source, file)) {
      assert.ok(!link.file.startsWith('..') && !link.file.startsWith('/'), `${file}: link escapes repository: ${link.file}`)
      const target = resolve(root, link.file)
      assert.ok(existsSync(target), `${file}: missing local target ${link.file}`)
      if (!link.fragment) continue
      assert.ok(/\.md$/i.test(link.file), `${file}: fragment target must be an inspected Markdown document: ${link.file}`)
      const targetSource = readFileSync(target, 'utf8')
      assert.ok(anchors(targetSource).has(link.fragment), `${file} -> ${link.file}#${link.fragment}`)
      checked++
    }
  }
  assert.ok(checked > 0, 'must inspect actual links, not a fixed version count')
})
test('both homepages expose extra examples and keep old section links in a closed disclosure', () => {
  for (const [file, source] of documents) {
    if (!file.startsWith('README')) continue
    const extra = localLinks(source, file).find(link => /seven-more|另外七类/.test(link.fragment || ''))
    assert.ok(extra, `${file}: examples entry`)
    assert.ok(anchors(documents.get(extra.file)).has(extra.fragment))
    const disclosure = source.match(/<details>\s*<summary>[^<]+<\/summary>([\s\S]*?)<\/details>/)
    assert.ok(disclosure, `${file}: closed native disclosure`)
    const oldLinks = localLinks(disclosure[1], file).filter(link => documents.has(link.file) && link.fragment)
    assert.ok(oldLinks.length > 0)
    for (const link of oldLinks) assert.ok(anchors(documents.get(link.file)).has(link.fragment), `${file}: old bookmark target ${link.fragment}`)
  }
})
