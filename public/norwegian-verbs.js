// Read-only Bokmålsordboka API. Inflections are looked up, never guessed.
// Source/licence and an explanation of our regrouping are shown on the page.
const API = 'https://ord.uib.no';
const CORE_FORMS = [['Inf', 'Infinitive'], ['Pres', 'Present'], ['Past', 'Past'], ['<PerfPart>', 'Past participle']];
const EXTRA_FORMS = [['Imp', 'Imperative'], ['Inf|Pass', 'Passive infinitive'], ['Pass|Pres', 'Passive present'], ['<PresPart>|Adj', 'Present participle']];
const ALLOWED = new Set([...CORE_FORMS, ...EXTRA_FORMS].map(([key]) => key));
const MAX_ARTICLES = 8;

export function normalizeVerb(raw) {
  const word = raw.normalize('NFC').trim().toLocaleLowerCase('nb-NO').replace(/^å\s+/, '');
  if (word === 'å' || !/^[a-zæøåéèêüöäóà]+(?:-[a-zæøåéèêüöäóà]+)*$/u.test(word) || word.length > 60) {
    throw new Error('Enter one Norwegian verb, such as snakke, å lese or gikk. For a phrase like glede seg, search for glede.');
  }
  return word;
}

function firstMeaning(elements) {
  for (const element of elements || []) {
    if (element.type_ === 'explanation' && typeof element.content === 'string') {
      let index = 0;
      const meaning = element.content.replace(/\$/g, () => {
        const item = element.items?.[index++];
        return item?.text || item?.lemmas?.[0]?.lemma || item?.id || '';
      }).trim();
      if (meaning) return meaning;
    }
    // Do not use the definition of a nested idiom/sub-article as the verb meaning.
    if (element.type_ === 'definition') {
      const meaning = firstMeaning(element.elements);
      if (meaning) return meaning;
    }
  }
  return '';
}

export function extractVerbEntries(article, id, today = new Date().toISOString().slice(0, 10)) {
  const entries = [];
  for (const lemma of article.lemmas || []) {
    const forms = {};
    for (const paradigm of lemma.paradigm_info || []) {
      if (!paradigm.tags?.includes('VERB')) continue;
      if (paradigm.standardisation && paradigm.standardisation !== 'STANDARD') continue;
      if ((paradigm.from && paradigm.from > today) || (paradigm.to && paradigm.to < today)) continue;
      for (const inflection of paradigm.inflection || []) {
        // Lexical s-verbs such as synes/trives use <SPass> on their core
        // forms. This is distinct from the productive passive tag, Pass.
        const key = (inflection.tags || []).filter(tag => tag !== '<SPass>').sort().join('|');
        if (!ALLOWED.has(key) || typeof inflection.word_form !== 'string' || !inflection.word_form) continue;
        if (!forms[key]) forms[key] = [];
        if (!forms[key].includes(inflection.word_form)) forms[key].push(inflection.word_form);
      }
    }
    if (Object.keys(forms).length && typeof lemma.lemma === 'string') {
      // Keep different lemmas and dictionary homonyms separate. Deduplicate only
      // identical forms within a single lemma (e.g. snakket in two paradigms).
      entries.push({ id, lemma: lemma.lemma, homonym: lemma.hgno || 0, forms, meaning: firstMeaning(article.body?.definitions) });
    }
  }
  return entries;
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderEntry(entry) {
  const card = node('article', 'verb-entry');
  const header = node('div', 'verb-entry__header');
  const heading = node('h3', '', entry.lemma);
  heading.lang = 'nb';
  if (entry.homonym) heading.append(node('sup', '', ' ' + entry.homonym));
  const link = node('a', '', 'Full dictionary entry ↗');
  link.href = 'https://ordbokene.no/bm/' + entry.id;
  header.append(heading, link);
  card.append(header);
  if (entry.meaning) {
    const meaning = node('p', 'verb-meaning', 'Meaning (Norwegian): ');
    const text = node('span', '', entry.meaning); text.lang = 'nb';
    meaning.append(text); card.append(meaning);
  }
  const forms = node('dl', 'verb-forms');
  for (const [key, label] of CORE_FORMS) {
    const group = node('div', 'verb-form');
    group.append(node('dt', '', label));
    const values = node('dd');
    if (entry.forms[key]?.length) {
      for (const form of entry.forms[key]) {
        const value = node('span', '', form); value.lang = 'nb'; values.append(value);
      }
    } else values.append(node('span', 'verb-form__missing', 'Not listed'));
    group.append(values); forms.append(group);
  }
  card.append(forms);
  const details = node('details', 'verb-more');
  details.append(node('summary', '', 'Imperative, passive & present participle'));
  const extras = node('dl');
  for (const [key, label] of EXTRA_FORMS) {
    const value = node('dd', '', entry.forms[key]?.join(' / ') || 'Not listed');
    if (entry.forms[key]?.length) value.lang = 'nb';
    extras.append(node('dt', '', label), value);
  }
  details.append(extras, node('p', '', 'Dictionary-listed forms. Not every form suits every meaning or sentence; open the dictionary entry for usage. “Not listed” means no form was supplied by the source.'));
  card.append(details);
  return card;
}

function initVerbs() {
  const form = document.getElementById('verb-form');
  if (!form) return;
  const input = document.getElementById('verb-input');
  const status = document.getElementById('verb-status');
  const results = document.getElementById('verb-results');
  const welcome = document.getElementById('verb-welcome');
  let controller;
  let generation = 0;

  function cancel() {
    generation++;
    controller?.abort();
    results.setAttribute('aria-busy', 'false');
  }
  async function search() {
    cancel();
    const current = generation;
    results.replaceChildren();
    welcome.hidden = true;
    let word;
    try {
      word = normalizeVerb(input.value);
      input.removeAttribute('aria-invalid');
    } catch (error) {
      input.setAttribute('aria-invalid', 'true');
      status.dataset.state = 'error'; status.textContent = error.message;
      return;
    }
    controller = new AbortController();
    const active = controller;
    const timer = setTimeout(() => active.abort(), 12000);
    status.dataset.state = 'loading';
    status.textContent = 'Looking up “' + word + '” in Bokmålsordboka…';
    results.setAttribute('aria-busy', 'true');
    async function getJSON(url) {
      const response = await fetch(url, { signal: active.signal });
      if (!response.ok) throw new Error('Dictionary request failed');
      return response.json();
    }
    try {
      const query = new URLSearchParams({ w: word, wc: 'VERB', dict: 'bm', scope: 'ei' });
      const listing = await getJSON(API + '/api/articles?' + query);
      if (!Array.isArray(listing.articles?.bm)) throw new Error('Unexpected dictionary response');
      const ids = [...new Set(listing.articles.bm)].filter(id => /^\d+$/.test(String(id)));
      const selected = ids.slice(0, MAX_ARTICLES);
      const articles = await Promise.all(selected.map(async id => ({ id, article: await getJSON(API + '/bm/article/' + id + '.json') })));
      if (current !== generation) return;
      const entries = articles.flatMap(({ article, id }) => extractVerbEntries(article, id));
      // Exact headwords first, while preserving separate homonyms/variants.
      entries.sort((a, b) => Number(b.lemma === word) - Number(a.lemma === word));
      for (const entry of entries) results.append(renderEntry(entry));
      status.dataset.state = entries.length ? 'success' : 'empty';
      if (!entries.length) {
        status.textContent = 'No current Bokmål verb forms found for “' + word + '”. Check the spelling or try the infinitive (for example, snakke). This tool does not cover every phrase or dialect form.';
      } else {
        status.textContent = 'Results for “' + word + '”. ' + (entries.length > 1 ? 'Several entries or spellings match; check each meaning. ' : '') + 'Alternative forms are listed together; different headwords stay separate.';
      }
      if (ids.length > MAX_ARTICLES) {
        const note = node('p', 'learning-help', 'Showing the first ' + MAX_ARTICLES + ' of ' + ids.length + ' dictionary articles. ');
        const link = node('a', '', 'See all matches on Ordbøkene');
        link.href = 'https://ordbokene.no/bm/search?q=' + encodeURIComponent(word) + '&scope=ei';
        note.append(link); results.append(note);
      }
    } catch (error) {
      if (current !== generation) return;
      status.dataset.state = 'error';
      status.textContent = active.signal.aborted
        ? 'The dictionary took too long to respond. Please try again.'
        : 'The dictionary is unavailable right now. Check your connection and try again. The reference guide below still works.';
    } finally {
      clearTimeout(timer);
      if (current === generation) results.setAttribute('aria-busy', 'false');
    }
  }
  form.addEventListener('submit', event => { event.preventDefault(); search(); });
  for (const button of document.querySelectorAll('[data-verb]')) {
    button.addEventListener('click', () => { input.value = button.dataset.verb; search(); });
  }
  input.addEventListener('input', () => {
    cancel(); results.replaceChildren(); status.textContent = '';
    input.removeAttribute('aria-invalid'); welcome.hidden = false;
  });
}
if (typeof document !== 'undefined') initVerbs();
