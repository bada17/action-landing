// action.or.kr의 공식 RSS 피드를 읽어 data/news.json을 갱신합니다.
// 실행: node scripts/fetch-news.mjs
// GitHub Actions에서 주기적으로 실행되도록 되어 있습니다
// (.github/workflows/update-news.yml 참고).

import { writeFile } from 'node:fs/promises';

const RSS_URL = 'https://action.or.kr/rss';
const MAX_ITEMS = 8; // 랜딩페이지 카드에 보여줄 개수. 늘리려면 이 숫자만 바꾸면 됨.
const OUTPUT_PATH = new URL('../data/news.json', import.meta.url);

// 카드에 올릴 게시판. action.or.kr/<번호>/ 의 번호이고, 여기 없는 게시판 글은 버림.
//   27 논평·보도자료 / 51 위원회 글 / 57 활동가 수첩
// 43번(시민 게시판)은 외부에서 누구나 쓸 수 있어 제외했음. 2026-08-13에 광고 글이
// 최신 8건을 전부 차지해 후원 페이지에 그대로 노출된 적이 있음.
// 게시판을 늘리려면 아래에 번호만 추가하면 됨.
const ALLOWED_BOARDS = new Set(['27', '51', '57']);

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

// https://action.or.kr/27/?idx=... → '27'
function boardOf(link) {
  const m = link.match(/action\.or\.kr\/(\d+)\//);
  return m ? m[1] : '';
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
  const all = parseItems(xml);

  if (!all.length) {
    throw new Error('RSS에서 항목을 하나도 찾지 못했습니다. 피드 형식이 바뀌었는지 확인하세요.');
  }

  const allowed = all.filter(it => ALLOWED_BOARDS.has(boardOf(it.link)));
  const items = allowed.slice(0, MAX_ITEMS);

  // 여기서 멈추면 data/news.json은 손대지 않은 채로 남아, 사이트는 직전 소식을
  // 계속 보여줍니다. 게시판 번호가 바뀌었을 때 빈 카드가 나가는 것보다 낫습니다.
  if (!items.length) {
    throw new Error(
      `RSS ${all.length}건 중 허용 게시판(${[...ALLOWED_BOARDS].join(', ')}) 글이 하나도 없습니다. ` +
      '게시판 번호가 바뀌었는지 확인하세요.'
    );
  }

  await writeFile(OUTPUT_PATH, JSON.stringify(items, null, 2) + '\n', 'utf-8');
  console.log(`data/news.json 갱신 완료 (${items.length}건, RSS ${all.length}건 중 ${all.length - allowed.length}건 제외)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
