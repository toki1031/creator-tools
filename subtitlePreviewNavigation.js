import { splitSubtitleCards } from './qualityLogic.js';

const clampInteger = (value, min, max) => Math.min(max, Math.max(min, Math.trunc(Number(value) || 0)));

export function resolveSubtitlePreviewCard(value = '', requestedIndex = 0, maxChars = 16, maxLines = 2) {
  const cards = splitSubtitleCards(value);
  if (!cards.length) {
    return {
      cards: [],
      cardCount: 0,
      index: 0,
      card: '',
      lines: [],
      overflow: false,
      hasPrevious: false,
      hasNext: false
    };
  }

  const index = clampInteger(requestedIndex, 0, cards.length - 1);
  const card = cards[index];
  const safeMaxChars = Math.max(1, Number(maxChars) || 16);
  const safeMaxLines = Math.max(1, Number(maxLines) || 2);
  const lines = [];

  if (/\n/.test(card)) {
    lines.push(...card.split('\n').map(line => line.trim()).filter(Boolean));
  } else {
    const chars = Array.from(card);
    while (chars.length) lines.push(chars.splice(0, safeMaxChars).join(''));
  }

  return {
    cards,
    cardCount: cards.length,
    index,
    card,
    lines: lines.slice(0, safeMaxLines),
    overflow: lines.length > safeMaxLines,
    hasPrevious: index > 0,
    hasNext: index < cards.length - 1
  };
}

function replacePreviewLines(element, lines) {
  element.replaceChildren();
  lines.forEach((line, index) => {
    if (index) element.appendChild(document.createElement('br'));
    element.appendChild(document.createTextNode(line));
  });
}

function installSubtitlePreviewNavigation() {
  const app = document.querySelector('#app');
  if (!app) return;

  let lastSceneIndex = null;
  let cardIndex = 0;
  let scheduled = false;

  const apply = () => {
    scheduled = false;
    const previewCard = app.querySelector('.subtitle-preview-card');
    const previewBox = app.querySelector('#subtitlePreview');
    const sceneSelect = app.querySelector('#previewScene');
    if (!previewCard || !previewBox || !sceneSelect) return;

    const sceneIndex = String(sceneSelect.value || '0');
    if (lastSceneIndex !== sceneIndex) {
      lastSceneIndex = sceneIndex;
      cardIndex = 0;
    }

    let controls = previewCard.querySelector('.subtitle-preview-navigation');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'subtitle-preview-navigation';
      controls.setAttribute('aria-label', '字幕カード切替');
      controls.innerHTML = '<button type="button" data-subtitle-preview-prev aria-label="前の字幕カード">◀ 前へ</button><span data-subtitle-preview-status aria-live="polite"></span><button type="button" data-subtitle-preview-next aria-label="次の字幕カード">次へ ▶</button>';
      previewBox.insertAdjacentElement('afterend', controls);
      controls.querySelector('[data-subtitle-preview-prev]').addEventListener('click', () => {
        cardIndex -= 1;
        apply();
      });
      controls.querySelector('[data-subtitle-preview-next]').addEventListener('click', () => {
        cardIndex += 1;
        apply();
      });
    }

    const textarea = app.querySelector(`[data-sub-text="${CSS.escape(sceneIndex)}"]`);
    const maxChars = Number(app.querySelector('#maxChars')?.value) || 16;
    const maxLines = Number(app.querySelector('#maxLines')?.value) || 2;
    const preview = resolveSubtitlePreviewCard(textarea?.value || '', cardIndex, maxChars, maxLines);
    cardIndex = preview.index;

    controls.hidden = preview.cardCount <= 1;
    const previous = controls.querySelector('[data-subtitle-preview-prev]');
    const next = controls.querySelector('[data-subtitle-preview-next]');
    const status = controls.querySelector('[data-subtitle-preview-status]');
    previous.disabled = !preview.hasPrevious;
    next.disabled = !preview.hasNext;
    const statusText = preview.cardCount ? `字幕 ${preview.index + 1}/${preview.cardCount}` : '字幕なし';
    if (status.textContent !== statusText) status.textContent = statusText;

    const cardLabel = previewBox.querySelector('.subtitle-card-count');
    if (cardLabel && preview.cardCount > 1) {
      const labelText = `字幕 ${preview.index + 1}/${preview.cardCount}（空行で切替）`;
      if (cardLabel.textContent !== labelText) cardLabel.textContent = labelText;
    }

    const rendered = previewBox.querySelector('.subtitle-render');
    if (!rendered) return;
    const signature = `${sceneIndex}|${preview.index}|${preview.card}|${maxChars}|${maxLines}`;
    if (rendered.dataset.previewCardSignature === signature) return;
    rendered.dataset.previewCardSignature = signature;
    rendered.classList.toggle('overflow', preview.overflow);
    replacePreviewLines(rendered, preview.lines);
  };

  const scheduleApply = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(apply);
  };

  const observer = new MutationObserver(scheduleApply);
  observer.observe(app, { childList: true, subtree: true });
  app.addEventListener('change', event => {
    if (event.target?.id === 'previewScene') {
      lastSceneIndex = null;
      cardIndex = 0;
      scheduleApply();
    }
  });
  scheduleApply();
}

if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  installSubtitlePreviewNavigation();
}
