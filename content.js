(() => {
  const key = '__bilingualKoV1';
  if (globalThis[key]) return;
  globalThis[key] = true;
  const owner = chrome.runtime.id;
  const ownedHosts = () => Array.from(document.querySelectorAll('bilingual-ko')).filter(host => host.getAttribute('data-bilingual-ko-owner') === owner);
  for (const host of ownedHosts()) host.remove();
  const ownedNotices = () => Array.from(document.querySelectorAll('bilingual-ko-notice')).filter(host => host.getAttribute('data-bilingual-ko-owner') === owner);
  for (const host of ownedNotices()) host.remove();

  const selector = 'p,h1,h2,h3,h4,h5,h6,li,td,th,blockquote,figcaption,div';
  const excluded = 'pre,code,kbd,samp,script,style,noscript,textarea,input,select,button,nav,[role="navigation"],[contenteditable]:not([contenteditable="false"]),[translate="no"],bilingual-ko,bilingual-ko-notice';
  const translated = new Map();
  const blocks = new Map();
  let currentJob = null;
  let sequence = 0;
  let pageRun = null;
  let pageEngine = null;
  let noticeHost = null;

  function visible(element) {
    if (!element.getClientRects().length) return false;
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (node.hidden || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return false;
    }
    return true;
  }

  function visibleText(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE || node.matches(excluded) || !visible(node)) return '';
    if (node.tagName === 'BR') return ' ';
    return Array.from(node.childNodes, visibleText).join('');
  }

  function recordText(record) {
    return record.nodes.map(visibleText).join('').replace(/\s+/g, ' ').trim();
  }

  function english(text) {
    const latin = text.match(/[a-z]/gi)?.length || 0;
    const letters = text.match(/\p{L}/gu)?.length || 0;
    return latin >= 4 && latin / Math.max(letters, 1) >= 0.75;
  }

  function segments(element) {
    const groups = [];
    let nodes = [];
    let hasBlocks = false;
    const flush = () => {
      if (nodes.length) groups.push(nodes);
      nodes = [];
    };
    for (const child of element.childNodes) {
      const block = child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BILINGUAL-KO' && (
        child.matches(selector) || /^(UL|OL|TABLE|SECTION|ARTICLE|HEADER|FOOTER|MAIN|ASIDE|DL)$/.test(child.tagName) ||
        /^(block|flex|grid|table|list-item)/.test(getComputedStyle(child).display)
      );
      if (block) { hasBlocks = true; flush(); }
      else if (child.nodeType !== Node.ELEMENT_NODE || child.tagName !== 'BILINGUAL-KO') nodes.push(child);
    }
    flush();
    return groups.map(group => {
      const record = { element, nodes: group, anchor: hasBlocks ? group.at(-1) : element, partial: hasBlocks };
      return { ...record, text: recordText(record) };
    }).filter(record => english(record.text));
  }

  function collect(job) {
    if (typeof job !== 'string' || !job) throw new Error('번역 작업 정보가 없습니다.');
    currentJob = job;
    blocks.clear();
    for (const [anchor, record] of translated) {
      if (!anchor.isConnected || !record.host.isConnected || recordText(record) !== record.text) {
        record.host.remove();
        translated.delete(anchor);
      }
    }
    const candidates = Array.from(document.querySelectorAll(selector)).filter(element => !element.closest(excluded) && visible(element));
    const records = candidates.flatMap(segments).filter(record => !translated.has(record.anchor));
    const result = records.slice(0, 2000).map(record => {
      const id = String(++sequence);
      blocks.set(id, record);
      return { id, text: record.text };
    });
    return { ok: true, blocks: result, limited: records.length > 2000 };
  }

  function apply(message) {
    const record = blocks.get(message.id);
    if (message.job !== currentJob || !record || !record.anchor.isConnected || !record.nodes.every(node => node.parentNode === record.element) || recordText(record) !== record.text) {
      return { ok: true, applied: false };
    }
    if (typeof message.text !== 'string' || !message.text.trim()) throw new Error('번역문이 비어 있습니다.');
    const element = record.element;
    translated.get(record.anchor)?.host.remove();
    const host = document.createElement('bilingual-ko');
    host.setAttribute('data-bilingual-ko-owner', owner);
    host.setAttribute('translate', 'no');
    host.style.setProperty('display', 'block', 'important');
    host.style.setProperty('margin', '0.35em 0 0.9em', 'important');
    host.style.setProperty('font-size', getComputedStyle(element).fontSize, 'important');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = ':host{font-size:inherit;line-height:1.65;font-weight:400;text-align:start}div{font-family:system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#424242;white-space:pre-wrap;overflow-wrap:anywhere}';
    const text = document.createElement('div');
    text.lang = 'ko';
    text.dir = 'ltr';
    text.textContent = message.text;
    shadow.append(style, text);
    if (record.partial) record.anchor.after(host);
    else if (['LI', 'TD', 'TH', 'BLOCKQUOTE', 'FIGCAPTION'].includes(element.tagName)) element.append(host);
    else element.after(host);
    translated.set(record.anchor, { ...record, host });
    blocks.delete(message.id);
    return { ok: true, applied: true };
  }

  function clear() {
    if (pageRun) pageRun.cancelled = true;
    pageRun = null;
    noticeHost?.remove();
    noticeHost = null;
    for (const host of ownedNotices()) host.remove();
    currentJob = null;
    blocks.clear();
    for (const { host } of translated.values()) host.remove();
    for (const host of ownedHosts()) host.remove();
    translated.clear();
    return { ok: true };
  }

  function showNotice(message, prepare) {
    noticeHost?.remove();
    noticeHost = document.createElement('bilingual-ko-notice');
    noticeHost.setAttribute('data-bilingual-ko-owner', owner);
    noticeHost.setAttribute('translate', 'no');
    noticeHost.style.cssText = 'position:fixed!important;bottom:16px!important;right:16px!important;z-index:2147483647!important;display:block!important;';
    const root = noticeHost.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = ':host{all:initial}section{font:13px/1.65 system-ui;max-width:320px;padding:12px 16px;background:#fff;color:#424242;border:1px solid #ddd;border-radius:8px;box-shadow:0 2px 12px #0002}button{font:inherit;color:#245f52;background:#f4f7f5;border:1px solid #ccc;border-radius:5px;margin:8px 6px 0 0;padding:5px 9px;cursor:pointer}';
    const section = document.createElement('section');
    section.lang = 'ko';
    section.setAttribute('role', 'status');
    const text = document.createElement('div');
    text.textContent = message;
    section.append(text);
    if (prepare) {
      const button = document.createElement('button');
      button.textContent = '모델 준비 후 번역';
      button.addEventListener('click', () => { button.disabled = true; prepare(); });
      section.append(button);
    }
    const dismiss = document.createElement('button');
    dismiss.textContent = '닫기';
    dismiss.addEventListener('click', () => {
      if (pageRun?.waiting) clear();
      else { noticeHost?.remove(); noticeHost = null; }
    });
    section.append(dismiss);
    root.append(style, section);
    document.documentElement.append(noticeHost);
  }

  async function translatePage(run) {
    run.waiting = false;
    try {
      if (!pageEngine) {
        const Engine = globalThis.__bilingualKoTranslationEngine;
        if (!Engine) throw new Error('확장을 새로고침한 뒤 다시 시도하세요.');
        pageEngine = new Engine(globalThis.Translator);
      }
      // This is also called directly by the optional first-use preparation button.
      await pageEngine.initialize(percent => {
        if (!run.cancelled && currentJob === run.job) showNotice(`번역 모델 다운로드 · ${percent}%`);
      });
      if (run.cancelled || currentJob !== run.job) return;
      noticeHost?.remove(); noticeHost = null;
      let failed = 0;
      let firstError = '';
      for (const block of run.blocks) {
        if (run.cancelled || currentJob !== run.job) break;
        try {
          const text = await pageEngine.translate(block.text, () => run.cancelled || currentJob !== run.job);
          if (run.cancelled || currentJob !== run.job) break;
          apply({ job: run.job, id: block.id, text });
        } catch (error) {
          if (run.cancelled || currentJob !== run.job) break;
          failed++; firstError ||= error.message;
        }
      }
      if (!run.cancelled && currentJob === run.job && failed) showNotice(`${failed}개 문단을 번역하지 못했습니다. ${firstError}`);
      else if (!run.cancelled && currentJob === run.job && run.limited) showNotice('한 번에 2,000개 문단까지 번역했습니다.');
    } catch (error) {
      if (run.cancelled || currentJob !== run.job) return;
      if (error.name === 'NotAllowedError') {
        run.waiting = true;
        showNotice('Chrome의 최초 모델 준비에는 페이지에서 한 번 클릭이 필요합니다.', () => {
          if (!run.cancelled && currentJob === run.job) void translatePage(run);
        });
      } else showNotice(`번역하지 못했습니다. ${error.message}`);
    } finally {
      if (pageRun === run && !run.waiting) pageRun = null;
    }
  }

  function toggle() {
    if (pageRun || ownedHosts().length) {
      clear();
      return { ok: true, action: 'removed' };
    }
    const job = `page-${Date.now()}-${++sequence}`;
    const result = collect(job);
    if (!result.blocks.length) {
      showNotice('번역할 영어 문단이 없습니다.');
      return { ok: true, action: 'empty' };
    }
    const run = { job, blocks: result.blocks, limited: result.limited, cancelled: false, waiting: false };
    pageRun = run;
    void translatePage(run);
    return { ok: true, action: 'started' };
  }

  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message?.channel !== 'bilingual-ko-v1') return;
    try {
      if (message.type === 'COLLECT') respond(collect(message.job));
      else if (message.type === 'APPLY') respond(apply(message));
      else if (message.type === 'CLEAR') respond(clear());
      else if (message.type === 'TOGGLE') respond(toggle());
      else if (message.type === 'CANCEL') {
        if (message.job === currentJob) { currentJob = null; blocks.clear(); }
        respond({ ok: true });
      }
    } catch (error) {
      respond({ ok: false, error: error.message });
    }
  });
})();
