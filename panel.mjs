import { TranslationEngine } from './engine.mjs';

const engine = new TranslationEngine(globalThis.Translator);
const startButton = document.querySelector('#translate');
const stopButton = document.querySelector('#stop');
const removeButton = document.querySelector('#remove');
const status = document.querySelector('#status');
const detail = document.querySelector('#detail');
const progress = document.querySelector('#progress');
const restartButton = document.querySelector('#restart');
let activeRun = null;
let removing = false;

function setBusy(busy) {
  startButton.disabled = busy || removing;
  stopButton.disabled = !busy || removing;
  removeButton.disabled = removing;
}

function describeError(error) {
  const message = error?.message || String(error);
  if (/Cannot access|Missing host permission/i.test(message)) {
    return '현재 페이지의 접근 권한이 없습니다. 패널을 닫고, 번역할 페이지에서 도구 모음의 확장 아이콘을 다시 누르세요.';
  }
  if (/Receiving end|Frame with ID|documentId|Could not establish/i.test(message)) {
    return '페이지 연결이 끊겼습니다. 페이지를 이동하거나 새로고침했다면 번역을 다시 시작하세요.';
  }
  if (/extensions gallery|No tab/i.test(message)) {
    return '번역할 일반 웹페이지를 열어 주세요. Chrome 내부 페이지와 웹 스토어는 번역할 수 없습니다.';
  }
  return `번역을 완료하지 못했습니다: ${message}`;
}

async function connect() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No tab');
  const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  const documentId = results.find(result => result.frameId === 0)?.documentId;
  if (!documentId) throw new Error('documentId를 확인할 수 없습니다.');
  return { tabId: tab.id, documentId };
}

async function send(target, type, values = {}) {
  const result = await chrome.tabs.sendMessage(target.tabId, { channel: 'bilingual-ko-v1', type, ...values }, { documentId: target.documentId });
  if (!result?.ok) throw new Error(result?.error || '페이지 응답을 확인할 수 없습니다.');
  return result;
}

async function startTranslation() {
  if (activeRun || removing) return;
  const run = { job: crypto.randomUUID(), cancelled: false, target: null };
  activeRun = run;
  setBusy(true);
  progress.hidden = false;
  progress.removeAttribute('value');
  detail.textContent = '';
  status.textContent = '번역 모델을 준비하고 있습니다. 첫 실행에는 다운로드가 필요합니다.';
  const ready = engine.initialize(percent => {
    if (activeRun === run && !run.cancelled) {
      status.textContent = `번역 모델 다운로드 · ${percent}%`;
      progress.value = percent;
    }
  });
  try {
    const [, target] = await Promise.all([ready, connect()]);
    run.target = target;
    if (run.cancelled) return;
    const { blocks, limited } = await send(run.target, 'COLLECT', { job: run.job });
    if (run.cancelled) return;
    if (!blocks.length) {
      status.textContent = '새로 번역할 영어 문단이 없습니다.';
      detail.textContent = '이미 번역했거나 지원하는 본문 블록이 없는 페이지일 수 있습니다.';
      progress.value = 100;
      return;
    }
    let applied = 0;
    let failed = 0;
    let skipped = 0;
    let firstFailure = '';
    for (let index = 0; index < blocks.length; index++) {
      if (run.cancelled) break;
      status.textContent = `번역 중 · ${index + 1} / ${blocks.length} 문단`;
      const block = blocks[index];
      let translated;
      try {
        translated = await engine.translate(block.text, () => run.cancelled);
      } catch (error) {
        if (run.cancelled) break;
        failed++;
        firstFailure ||= error.message;
        progress.value = Math.round((index + 1) / blocks.length * 100);
        continue;
      }
      if (run.cancelled) break;
      const response = await send(run.target, 'APPLY', { job: run.job, id: block.id, text: translated });
      if (response.applied) applied++;
      else skipped++;
      progress.value = Math.round((index + 1) / blocks.length * 100);
    }
    if (!run.cancelled) {
      status.textContent = failed ? `${applied}개 문단 번역 · ${failed}개 실패` : `${applied}개 문단을 번역했습니다.`;
      detail.textContent = [firstFailure, skipped ? `${skipped}개 문단은 내용이 변경되어 건너뛰었습니다.` : '', limited ? '한 번에 2,000개까지 처리합니다. 버튼을 다시 눌러 나머지를 번역하세요.' : ''].filter(Boolean).join(' ');
    }
  } catch (error) {
    if (!run.cancelled) {
      status.textContent = describeError(error);
      detail.textContent = `원인: ${error?.message || String(error)}`;
      progress.hidden = true;
    }
  } finally {
    if (activeRun === run) {
      activeRun = null;
      setBusy(false);
      if (run.cancelled) progress.hidden = true;
    }
  }
}

startButton.addEventListener('click', () => startTranslation());

stopButton.addEventListener('click', () => {
  const run = activeRun;
  if (!run) return;
  run.cancelled = true;
  status.textContent = '번역을 중지했습니다. 완료된 번역은 페이지에 남아 있습니다.';
  stopButton.disabled = true;
  if (run.target) send(run.target, 'CANCEL', { job: run.job }).catch(error => {
    detail.textContent = describeError(error);
  });
});

removeButton.addEventListener('click', async () => {
  if (removing) return;
  removing = true;
  const run = activeRun;
  if (run) run.cancelled = true;
  setBusy(Boolean(activeRun));
  try {
    const target = await connect();
    await send(target, 'CLEAR');
    status.textContent = '현재 페이지의 한국어 번역을 지웠습니다.';
    detail.textContent = '';
    progress.hidden = true;
  } catch (error) {
    status.textContent = describeError(error);
  } finally {
    removing = false;
    setBusy(Boolean(activeRun));
  }
});

restartButton.addEventListener('click', () => {
  chrome.runtime.reload();
});
