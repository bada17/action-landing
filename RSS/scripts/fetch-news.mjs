// action.or.kr의 공식 RSS 피드를 읽어 data/news.json을 갱신합니다.
// 실행: node scripts/fetch-news.mjs
// GitHub Actions에서 주기적으로 실행되도록 되어 있습니다
// (.github/workflows/update-news.yml 참고).

import { writeFile } from 'node:fs/promises';

const RSS_URL = 'https://action.or.kr/rss';
const MAX_ITEMS = 8; // 랜딩페이지 카드에 보여줄 개수. 늘리려면 이 숫자만 바꾸면 됨.
const OUTPUT_PATH = new URL('../data/news.json', import.meta.url);

function parseItems(xml) {
  const items = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

  for (const block of itemBlocks) {
    const title = decodeEntities(matchTag(block, 'title'));
    const link = decodeEntities(matchTag(block, 'link'));
    const pubDate = matchTag(block, 'pubDate');
    if (!title || !link || !pubDate) continue;

    const date = new Date(pubDate);
    const isoDate = Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); // YYYY-MM-DD

    items.push({ title, link, date: isoDate });
  }
  return items;
}

function matchTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].trim() : '';
}

function decodeEntities(str) {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function main() {
  const res = await fetch(RSS_URL);
  if (!res.ok) {
    throw new Error(`RSS 요청 실패: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();
  const items = parseItems(xml).slice(0, MAX_ITEMS);

  if (!items.length) {
    throw new Error('RSS에서 항목을 하나도 찾지 못했습니다. 피드 형식이 바뀌었는지 확인하세요.');
  }

  await writeFile(OUTPUT_PATH, JSON.stringify(items, null, 2) + '\n', 'utf-8');
  console.log(`data/news.json 갱신 완료 (${items.length}건)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
