// Run with: node --test tests/tools-learning.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { cardinal, ordinal, convertNumber } from '../public/norwegian-numbers.js';
import { normalizeVerb, extractVerbEntries } from '../public/norwegian-verbs.js';

test('cardinals: zero, compounds and hundred/thousand boundaries', () => {
  const cases = new Map([
    [0, 'null'], [1, 'en'], [7, 'sju'], [18, 'atten'], [20, 'tjue'], [21, 'tjueen'], [30, 'tretti'], [40, 'førti'], [80, 'åtti'], [99, 'nittini'],
    [100, 'ett hundre'], [101, 'ett hundre og en'], [110, 'ett hundre og ti'], [200, 'to hundre'], [325, 'tre hundre og tjuefem'],
    [1000, 'ett tusen'], [1001, 'ett tusen og en'], [1100, 'ett tusen ett hundre'], [1250, 'ett tusen to hundre og femti'],
    [10001, 'ti tusen og en'], [21000, 'tjueen tusen'], [100000, 'ett hundre tusen'], [999999, 'ni hundre og nittini tusen ni hundre og nittini']
  ]);
  for (const [n, words] of cases) assert.equal(cardinal(n), words, String(n));
  for (const n of [-1, 0.1, 1000000, NaN, Infinity]) assert.throws(() => cardinal(n));
});

test('all supported ordinals produce words, with irregular endings', () => {
  for (let n = 1; n <= 100; n++) assert.match(ordinal(n), /^[a-zæøå]+$/);
  for (const [n, words] of [[1,'første'],[2,'andre'],[3,'tredje'],[6,'sjette'],[17,'syttende'],[20,'tjuende'],[21,'tjueførste'],[30,'trettiende'],[31,'trettiførste'],[80,'åttiende'],[99,'nittiniende'],[100,'hundrede']]) assert.equal(ordinal(n), words);
  for (const n of [0, 101, 1.2, NaN]) assert.throws(() => ordinal(n));
});

test('years: century readings, full thousands and joined spelling', () => {
  assert.equal(convertNumber('year','1000').words,'tusen');
  assert.equal(convertNumber('year','1001').words,'tusenogen');
  assert.equal(convertNumber('year','1099').words,'tusenognittini');
  for (const [n, words] of [['1814','attenfjorten'],['1900','nittenhundre'],['1905','nittenhundreogfem'],['1998','nittennittiåtte'],['2000','totusen'],['2001','totusenogen'],['2026','totusenogtjueseks'],['2099','totusenognittini']]) assert.equal(convertNumber('year',n).words, words);
  for (const value of ['999', '2100', '2026.0', '2e3']) assert.throws(() => convertNumber('year',value));
});

test('prices: exact decimals, singulars, fractions and grouping', () => {
  for (const [raw, words] of [['0','null kroner'],['1','én krone'],['0,01','ett øre'],['1,01','én krone og ett øre'],['21,50','tjueen kroner og femti øre'],['149.5','ett hundre og førtini kroner og femti øre'],['1 250,99','ett tusen to hundre og femti kroner og nittini øre']]) assert.equal(convertNumber('price',raw).words, words);
  assert.equal(convertNumber('price','0.1').digits,'0,10 kr');
  assert.equal(convertNumber('price','999999,99').digits.replace(/\s/g,''),'999999,99kr');
  for (const raw of ['1,234','1000000','-1','1.2.3','1 2','1,','1 250.123','NaN']) assert.throws(() => convertNumber('price',raw));
});

test('phone numbers preserve zeros and an optional country code', () => {
  const value = convertNumber('phone','+47 01 23 45 67');
  assert.equal(value.digits,'+47 01 23 45 67');
  assert.equal(value.words,'pluss førtisju · null · en · to · tre · fire · fem · seks · sju');
  assert.equal(convertNumber('phone','12-34-56-78').digits,'12 34 56 78');
  for (const raw of ['123','123456789','+4812345678','abcdefgh']) assert.throws(() => convertNumber('phone',raw));
});

test('numeric input validates instead of silently changing ambiguous values', () => {
  assert.equal(convertNumber('cardinal','1\u00a0250').words,cardinal(1250));
  for (const raw of ['', ' ', '1 25', '1,250', '1.25', '-1', 'Infinity', '<script>', '1e2']) assert.throws(() => convertNumber('cardinal',raw));
  assert.throws(() => convertNumber('unknown','21'));
});

test('verb input accepts Norwegian, å and an inflected form, but no wildcards or HTML', () => {
  assert.equal(normalizeVerb('  Å VÆRE  '),'være');
  assert.equal(normalizeVerb('gikk'),'gikk');
  assert.equal(normalizeVerb('ga\u030a'),'gå');
  for (const raw of ['', 'å', '*', 'snakke|lese', '<img>', 'abc123', 'glede seg', 'x'.repeat(61)]) assert.throws(() => normalizeVerb(raw));
});

const inf = (tags, word_form) => ({tags,word_form});
const paradigm = (inflection, extra = {}) => ({tags:['VERB'],standardisation:'STANDARD',from:'1996-01-01',to:null,inflection,...extra});
const article = (paradigms, name = 'snakke') => ({lemmas:[{lemma:name,hgno:0,paradigm_info:paradigms}],body:{definitions:[]}});

test('parser combines alternatives without confusing adjectival participles with verbs', () => {
  const data = article([
    paradigm([inf(['Inf'],'snakke'),inf(['Past'],'snakka'),inf(['<PerfPart>'],'snakka')]),
    paradigm([inf(['Past'],'snakket'),inf(['<PerfPart>'],'snakket'),inf(['Adj','<PerfPart>','Plur'],'snakkede'),inf(['Pres','Pass'],'snakkes')]),
    paradigm([inf(['Past'],'snakket'),inf([],null)])
  ]);
  const entry = extractVerbEntries(data,55031)[0];
  assert.deepEqual(entry.forms.Past,['snakka','snakket']);
  assert.deepEqual(entry.forms['<PerfPart>'],['snakka','snakket']);
  assert.deepEqual(entry.forms['Pass|Pres'],['snakkes']);
  assert.equal(entry.forms.Imp,undefined); // No invented imperative.
  assert(!JSON.stringify(entry.forms).includes('snakkede'));
});

test('parser supports lexical s-verbs, retaining their real core forms', () => {
  const data=article([paradigm([inf(['Inf','<SPass>'],'synes'),inf(['Pres','<SPass>'],'syns'),inf(['Past','<SPass>'],'syntes')])],'synes');
  const entry=extractVerbEntries(data,1)[0];
  assert.deepEqual(entry.forms.Inf,['synes']);
  assert.deepEqual(entry.forms.Past,['syntes']);
});

test('parser excludes nonverbs, old/unofficial/future forms and keeps headwords separate', () => {
  const data=article([
    paradigm([inf(['Past'],'snakka')]),
    paradigm([inf(['Past'],'old')],{to:'1990-01-01'}),
    paradigm([inf(['Past'],'future')],{from:'2099-01-01'}),
    paradigm([inf(['Past'],'nonstandard')],{standardisation:'NONSTANDARD'}),
    paradigm([inf(['Past'],'noun')],{tags:['NOUN']})
  ]);
  data.lemmas.push({lemma:'other',hgno:2,paradigm_info:[paradigm([inf(['Past'],'other form')])]});
  const entries=extractVerbEntries(data,123,'2026-01-01');
  assert.equal(entries.length,2);
  assert.deepEqual(entries[0].forms.Past,['snakka']);
  assert.deepEqual(entries[1].forms.Past,['other form']);
  assert.equal(entries[1].homonym,2);
  assert.deepEqual(extractVerbEntries({},1),[]);
});

test('meanings resolve inline references and do not borrow a nested idiom definition', () => {
  const data=article([paradigm([inf(['Inf'],'snakke')])]);
  data.body.definitions=[{type_:'definition',elements:[{type_:'sub_article',article:{body:{definitions:[{type_:'explanation',content:'wrong'}]}}},{type_:'definition',elements:[{type_:'explanation',content:'$ sammen',items:[{type_:'article_ref',lemmas:[{lemma:'prate'}]}]}]}]}];
  assert.equal(extractVerbEntries(data,1)[0].meaning,'prate sammen');
});

test('new pages have one main heading, shared nav, seven app languages and valid local assets/links', () => {
  const root=resolve('public');
  for (const name of ['norwegian-number-system','norwegian-verb-conjugator']) {
    const filename=resolve(root,'pages/tools',name+'.html'), html=readFileSync(filename,'utf8');
    assert.equal((html.match(/<h1[ >]/g)||[]).length,1);
    assert(html.includes('aria-current="location">Tools'));
    assert.equal((html.match(/class="app-promo__store"/g)||[]).length,2);
    assert.equal((html.match(/width="22" height="22"/g)||[]).length,7);
    assert(html.includes('mobile app'));
    assert(html.includes('The whole app, in your language'));
    const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(new Set(ids).size,ids.length,'Duplicate id');
    for(const [,url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^https?:/.test(url)) continue;
      if (url.startsWith('#')) { assert(ids.includes(url.slice(1)),url); continue; }
      assert(existsSync(resolve(dirname(filename),url.split(/[?#]/)[0])),url);
    }
  }
  const tools=readFileSync(resolve(root,'pages/tools.html'),'utf8');
  assert.equal((tools.match(/class="tool-card coming-soon"/g)||[]).length,2);
  assert(tools.includes('href="tools/norwegian-number-system.html"'));
  assert(tools.includes('href="tools/norwegian-verb-conjugator.html"'));
});
