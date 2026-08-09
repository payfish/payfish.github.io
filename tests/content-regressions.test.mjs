import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import frontMatter from 'hexo-front-matter';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

async function parsePost(filename) {
  const markdown = await readFile(
    path.join(projectRoot, 'source', '_posts', filename),
    'utf8',
  );

  return frontMatter.parse(markdown);
}

function formatParsedDate(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return `${values.year}-${values.month}-${values.day}`;
}

async function assertPostMetadata(filename, expected) {
  const post = await parsePost(filename);

  assert.equal(post.title, expected.title, 'missing or incorrect front matter title');
  assert.equal(formatParsedDate(post.date), expected.date);
  assert.deepEqual(post.categories, expected.categories);
  assert.deepEqual(post.tags, expected.tags);
  assert.doesNotMatch(post._content.trimStart(), /^#\s+/, 'body must not start with H1');
}

test('RAG post has canonical metadata and no duplicate body H1', async () => {
  await assertPostMetadata('RAG学习笔记.md', {
    title: 'RAG学习笔记',
    date: '2026-03-11',
    categories: ['AI学习'],
    tags: ['RAG', '大模型', '知识库'],
  });
});

test('NLP post has canonical metadata and no duplicate body H1', async () => {
  await assertPostMetadata('NLP学习笔记.md', {
    title: 'NLP学习笔记',
    date: '2026-03-15',
    categories: ['AI学习'],
    tags: ['NLP', '大模型'],
  });
});

test('RAG post uses copyable prompt code and a local architecture diagram', async () => {
  const post = await parsePost('RAG学习笔记.md');

  assert.match(post._content, /def build_prompt\(context: str, question: str\) -> str:/);
  assert.match(post._content, /!\[RAG系统架构\]\(\/images\/rag-architecture\.svg\)/);
  assert.doesNotMatch(post._content, /[A-Za-z]:\\/, 'body must not contain a Windows drive path');
  assert.doesNotMatch(post._content, /pica\.zhimg\.com/, 'body must not hotlink pica.zhimg.com');
  await access(path.join(projectRoot, 'source', 'images', 'rag-architecture.svg'));
});
