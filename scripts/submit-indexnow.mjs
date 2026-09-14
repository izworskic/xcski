import { readFile } from 'node:fs/promises';
import path from 'node:path';

const env = process.env.VERCEL_ENV || '';
if (env !== 'production') {
  console.log(`IndexNow skipped: VERCEL_ENV=${env || 'unset'}`);
  process.exit(0);
}

try {
  const discovery = JSON.parse(await readFile(path.join(process.cwd(),'dist','search-discovery.json'),'utf8'));
  if (!Array.isArray(discovery.urls) || !discovery.urls.length) throw new Error('No canonical URLs found');
  const response = await fetch('https://api.indexnow.org/IndexNow', {
    method: 'POST',
    headers: { 'content-type':'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: 'xcski.chrisizworski.com',
      key: discovery.indexNowKey,
      keyLocation: discovery.keyLocation,
      urlList: discovery.urls
    })
  });
  const text = await response.text().catch(()=>'');
  if (!response.ok) {
    console.warn(`IndexNow submission warning: HTTP ${response.status}${text ? ` · ${text.slice(0,300)}` : ''}`);
    process.exit(0);
  }
  console.log(`IndexNow submission accepted: HTTP ${response.status} · ${discovery.urls.length} canonical URLs`);
} catch (error) {
  console.warn(`IndexNow submission warning: ${error.message}`);
}
