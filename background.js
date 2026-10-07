// Toolbar clicks grant activeTab and open the optional controls.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(console.error);
chrome.action.onClicked.addListener(tab => {
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
});

const menuId = 'bilingual-ko-translate';
const tabQueues = new Map();

chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
      id: menuId,
      title: '번역하기',
      contexts: ['page', 'selection', 'link'],
      documentUrlPatterns: ['http://*/*', 'https://*/*'],
    }, () => {
      if (chrome.runtime.lastError) console.error(chrome.runtime.lastError.message);
    });
  } catch (error) { console.error(error); }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== menuId || !tab?.id) return;
  // Capture the clicked document immediately, and preserve click order per tab.
  const injected = chrome.scripting.executeScript({
    target: { tabId: tab.id }, files: ['engine-content.js', 'content.js'],
  }).then(results => {
    const documentId = results.find(result => result.frameId === 0)?.documentId;
    if (!documentId) throw new Error('documentId를 확인할 수 없습니다.');
    return documentId;
  });
  // Attach the rejection handler immediately while an earlier toggle is pending.
  const ready = injected.then(documentId => ({ documentId }), error => ({ error }));
  const previous = tabQueues.get(tab.id) || Promise.resolve();
  const operation = previous.then(async () => {
    const { documentId, error } = await ready;
    if (error) throw error;
    const response = await chrome.tabs.sendMessage(tab.id, {
      channel: 'bilingual-ko-v1', type: 'TOGGLE',
    }, { documentId });
    if (!response?.ok) throw new Error(response?.error || '번역 요청을 처리하지 못했습니다.');
  }).catch(error => {
    console.error(error);
    chrome.action.setBadgeText({ tabId: tab.id, text: '!' }).catch(console.error);
    chrome.action.setTitle({ tabId: tab.id, title: `번역 요청 실패: ${error.message}` }).catch(console.error);
  }).finally(() => {
    if (tabQueues.get(tab.id) === operation) tabQueues.delete(tab.id);
  });
  tabQueues.set(tab.id, operation);
  return operation;
});
