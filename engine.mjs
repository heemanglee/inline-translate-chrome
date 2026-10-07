export function splitText(text, maxLength = 4000) {
  const chunks = [];
  let offset = 0;
  while (offset < text.length) {
    let end = Math.min(offset + maxLength, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf(' ', end - 1);
      if (boundary > offset + maxLength / 2) end = boundary + 1;
      if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
    }
    chunks.push(text.slice(offset, end));
    offset = end;
  }
  return chunks;
}

export class TranslationEngine {
  constructor(api) {
    this.api = api;
    this.translator = null;
    this.pending = null;
    this.cache = new Map();
  }

  initialize(onProgress = () => {}) {
    if (this.translator) return Promise.resolve();
    if (this.pending) return this.pending;
    if (!this.api?.create) {
      return Promise.reject(new Error('Chrome 내장 번역을 사용할 수 없습니다. Chrome 138 이상으로 업데이트하고 일반 프로필에서 다시 시도하세요.'));
    }
    try {
      // create must run directly in the button gesture, before any awaited tab calls.
      this.pending = Promise.resolve(this.api.create({
        sourceLanguage: 'en',
        targetLanguage: 'ko',
        monitor: monitor => monitor.addEventListener('downloadprogress', event => {
          onProgress(Math.round(event.loaded * 100));
        }),
      })).then(translator => {
        this.translator = translator;
      }).finally(() => { this.pending = null; });
      return this.pending;
    } catch (error) {
      this.pending = null;
      return Promise.reject(error);
    }
  }

  async translate(text, isCancelled = () => false) {
    if (!this.translator) throw new Error('번역 모델을 먼저 준비하세요.');
    if (this.cache.has(text)) return this.cache.get(text);
    const parts = [];
    for (const chunk of splitText(text)) {
      if (isCancelled()) throw new Error('번역이 중지되었습니다.');
      const result = await this.translator.translate(chunk);
      if (!result?.trim()) throw new Error('모델이 빈 번역을 반환했습니다. 다시 시도하세요.');
      parts.push(result.trim());
    }
    const translated = parts.join('\n');
    if (this.cache.size >= 500) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(text, translated);
    return translated;
  }
}
