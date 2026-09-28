/* Lumen fun: the neural critic, achievements, meme captions and the VHS date stamp.
 * Nothing here touches the DOM except through a canvas context it is handed, so the
 * critic's verdicts and the achievement rules are unit-tested in node. */
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (a, rnd) => a[Math.floor(rnd() * a.length) % a.length];

  // ---------- Achievements ----------
  const ACHIEVEMENTS = [
    { id: 'export', e: '📸', n: 'Первый кадр', d: 'Сохранить фото' },
    { id: 'export10', e: '🖨️', n: 'Фотостудия', d: 'Сохранить 10 фото' },
    { id: 'dice', e: '🎲', n: 'Азартный', d: 'Бросить кубик 10 раз' },
    { id: 'jackpot', e: '🍀', n: 'Джекпот', d: 'Выбросить счастливую шестёрку' },
    { id: 'critfail', e: '💀', n: 'Критический провал', d: 'Выбросить роковую единицу' },
    { id: 'shakal', e: '🦊', n: 'Повелитель шакалов', d: 'Выкрутить «Шакалов» на максимум' },
    { id: 'fry', e: '🔥', n: 'Прожарка well done', d: 'Зажарить фото 5 раз подряд' },
    { id: 'eyes', e: '🌈', n: 'Вырвиглаз', d: 'Насыщенность +100' },
    { id: 'noir', e: '🕵️', n: 'Нуарный детектив', d: 'Применить фильтр «Нуар»' },
    { id: 'time', e: '🕰️', n: 'Путешественник во времени', d: 'Отменить 30 действий' },
    { id: 'owl', e: '🦉', n: 'Сова', d: 'Редактировать между полуночью и пятью утра' },
    { id: 'konami', e: '🎮', n: 'Читер', d: '↑ ↑ ↓ ↓ ← → ← → B A' },
    { id: 'egg', e: '🥚', n: 'Пасхальный кролик', d: 'Семь раз ткнуть в логотип' },
    { id: 'critic', e: '🧐', n: 'Под прицелом критики', d: 'Показать кадр нейрокритику' },
    { id: 'masterpiece', e: '🏆', n: 'Шедевр', d: 'Получить 10 из 10 от нейрокритика' },
    { id: 'meme', e: '💬', n: 'Мемолог', d: 'Подписать кадр мем-текстом' },
    { id: 'stickers', e: '😎', n: 'Стикерпак', d: 'Налепить 10 стикеров' },
    { id: 'curves', e: '📈', n: 'Кривые руки', d: 'Поработать с кривыми' },
    { id: 'duck', e: '🦆', n: 'Кря', d: 'Включить звуковой пакет «Утка»' },
    { id: 'hacker', e: '⌨️', n: 'Хакер', d: 'Открыть палитру команд' },
    { id: 'pixel', e: '👾', n: 'Олдфаг', d: 'Включить Game Boy или пиксели' },
    { id: 'all', e: '👑', n: 'Коллекционер', d: 'Собрать все остальные достижения' },
  ];
  /** Sanitise a stored list: only known ids, no duplicates. */
  const cleanUnlocked = raw => (Array.isArray(raw) ? [...new Set(raw.filter(id => ACHIEVEMENTS.some(a => a.id === id)))] : []);
  /** Returns the ids newly unlocked by adding `id` — the collector badge rides along with the last one. */
  function unlock(list, id) {
    if (!ACHIEVEMENTS.some(a => a.id === id) || list.includes(id)) return [];
    list.push(id);
    const out = [id];
    const rest = ACHIEVEMENTS.filter(a => a.id !== 'all');
    if (!list.includes('all') && rest.every(a => list.includes(a.id))) { list.push('all'); out.push('all'); }
    return out;
  }

  // ---------- Neural critic ----------
  // It really does read the frame: brightness, clipping, saturation and contrast come from
  // Analysis.summarize; only the wording is random.
  const LINES = {
    clipLight: ['Пересвет {p}% — солнце просит вернуть ему яркость.', 'Света выбиты, как окна в заброшке.', 'Белое пятно на {p}% кадра. Это облако или вспышка сверхновой?'],
    clipDark: ['В тенях можно спрятать слона. Или налоговую.', 'Провалы в тень такие, что там живёт Горлум.', 'Чёрного {p}%. Кажется, там кто-то есть.'],
    dark: ['Темновато. Вы снимали в чёрной дыре?', 'Атмосферно. Правда, ничего не видно.', 'Идеальный кадр для фильма ужасов. Страшно — значит работает.'],
    bright: ['Светло, как в кабинете стоматолога.', 'Я ослеп, но мне понравилось.', 'Экспозиция уровня «забыл закрыть диафрагму».'],
    loud: ['Цвета кричат. Соседи жалуются.', 'Вырвиглаз уровня «обои на рабочем столе 2007».', 'Насыщенно, как бабушкин борщ.'],
    gray: ['Пятьдесят оттенков серого. Буквально.', 'Ч/Б — значит искусство. Так и запишем.', 'Цвет ушёл за хлебом и не вернулся.'],
    punchy: ['Контраст бодрый — как кофе в понедельник.', 'Чёткие тени, ясные света. Уважаю.'],
    flat: ['Контраст ушёл в отпуск.', 'Плоско, как шутки в лифте.', 'Не хватает драмы. Добавьте конфликт или контраст.'],
    shakal: ['Шакалы одобряют. Все сорок восемь.', 'Качество как у мема, пересланного в пятый раз. Узнаю почерк.', 'Сжатие JPEG — не баг, а жанр.'],
    thermal: ['Тепловизор засёк… ваш вкус. Горячо.', 'Предатор бы оценил.'],
    gameboy: ['Game Boy одобряет, батарейки — нет.', 'Четыре оттенка зелёного — больше и не нужно.'],
    vhs: ['Пахнет видеосалоном и чипсами.', 'Кто-нибудь, перемотайте кассету карандашом.'],
    acid: ['Я это видел. Мне это не понравилось. Мне понравилось.', 'Художник так видит. Художник, отдохните.'],
    nightvision: ['Режим «спецоперация по поиску холодильника».', 'Зелёный — цвет разведки и хорошего настроения.'],
    pixel: ['Пиксели размером с кирпич — очень честно.', 'Майнкрафт-версия вашей жизни.'],
    stickers: ['Стикеры спасают любой кадр. Почти любой.', 'Стикеров больше, чем смысла. Одобряю.'],
    meme: ['Мем засчитан. Смешно ли — решат потомки.', 'Подпись капсом — это классика.'],
    busy: ['Вы подкрутили {n} ползунков. Внутренний фотограф плачет от гордости.', '{n} изменённых настроек — это уже не обработка, это характер.'],
    untouched: ['Вы ничего не трогали. Смело. Минимализм.', 'Оригинал? Уважаю честность.'],
    balanced: ['Баланс света как у бариста латте-арт.', 'Гистограмма ровная, душа спокойная.', 'Тона лежат аккуратно, как носки у отличника.'],
    filler: ['Моя бабушка поставила бы это в рамочку.', 'Кот посмотрел и одобрительно моргнул.', 'Уже вижу это в сторис с подписью «вайб».', 'Если прищуриться — Ван Гог.', 'Лайк от меня, но я робот, так что не считается.', 'Показал бы маме. Мама сказала «красиво».'],
  };
  const VERDICTS = [
    [10, 'Шедевр. Лувр уже звонил'],
    [8.5, 'Крепко! В рамочку и на стену'],
    [7, 'Хорошо. Лайк обеспечен'],
    [5.5, 'Норм. Бабушка оценит'],
    [4, 'Ну такое…'],
    [2.5, 'Удаляй, пока никто не видел'],
    [0, 'Это преступление против пикселей'],
  ];
  const FUN_KEYS = ['thermal', 'gameboy', 'vhs', 'acid', 'nightvision', 'pixel'];

  /**
   * stats: Analysis.summarize output; eff: effective adjustments; extra: { changed, stickers, meme }.
   * Returns { score (1–10, or the fox for fully crushed JPEG), verdict, lines[3], rating (0–5 stars) }.
   */
  function critic(stats, eff, extra, rnd) {
    rnd = rnd || Math.random;
    eff = eff || {}; extra = extra || {};
    const lines = [], add = (k, vars) => {
      let t = pick(LINES[k], rnd);
      for (const v in vars || {}) t = t.replace('{' + v + '}', vars[v]);
      if (!lines.includes(t)) lines.push(t);
    };
    let score = 7.4;
    const pct = v => String(Math.round(v * 100));
    if (stats.clipLight > 0.03) { score -= Math.min(3, stats.clipLight * 55); add('clipLight', { p: pct(stats.clipLight) }); }
    if (stats.clipDark > 0.05) { score -= Math.min(2, stats.clipDark * 25); add('clipDark', { p: pct(stats.clipDark) }); }
    if (stats.luma < 0.2) { score -= 1.2; add('dark'); } else if (stats.luma > 0.74) { score -= 1.2; add('bright'); }
    if (stats.saturation > 0.55) { score -= 1.1; add('loud'); } else if (stats.saturation < 0.06) add('gray');
    if (stats.contrast >= 0.16 && stats.contrast <= 0.34) { score += 0.9; if (lines.length < 2) add('punchy'); } else if (stats.contrast < 0.1) { score -= 0.8; add('flat'); }
    if (!lines.length) { score += 1.2; add('balanced'); }
    const fun = FUN_KEYS.filter(k => (eff[k] || 0) > 25).sort((a, b) => eff[b] - eff[a]);
    if (fun.length) { add(fun[0]); score += 0.5; }
    if ((eff.jpeg || 0) > 25) add('shakal');
    if (extra.stickers) { add('stickers'); score += 0.4; }
    if (extra.meme) { add('meme'); score += 0.6; }
    if (extra.changed > 9) add('busy', { n: extra.changed });
    else if (extra.changed === 0 && !fun.length && !extra.stickers) add('untouched');
    while (lines.length < 3) add('filler');
    score = clamp(Math.round((score + (rnd() - 0.5) * 1.2) * 2) / 2, 1, 10);
    const shakal = (eff.jpeg || 0) >= 70;
    const verdict = shakal ? 'Официально признано шакальным' : VERDICTS.find(v => score >= v[0])[1];
    return { score: shakal ? '🦊' : score, verdict, lines: lines.slice(0, 3), rating: shakal ? 5 : Math.round(score / 2) };
  }

  // ---------- Overlays painted over the photo (and into the export) ----------
  const MEME_FONT = 'Impact, Anton, "Arial Black", "Helvetica Neue", sans-serif';
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  /** Split text into at most `max` lines that fit `width` at the current ctx font. */
  function wrap(ctx, text, width, max) {
    const words = text.split(/\s+/).filter(Boolean), out = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > width && line) { out.push(line); line = w; } else line = t;
    }
    if (line) out.push(line);
    return out.slice(0, max);
  }
  function memeBlock(ctx, text, w, h, top) {
    text = String(text || '').trim().toUpperCase();
    if (!text) return;
    let size = h * 0.12, lines;
    for (let i = 0; i < 12; i++) {
      ctx.font = `${size}px ${MEME_FONT}`;
      lines = wrap(ctx, text, w * 0.92, 3);
      const widest = Math.max(...lines.map(l => ctx.measureText(l).width));
      if (widest <= w * 0.92 && lines.join(' ').length >= text.length - 1) break;
      size *= 0.88;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = top ? 'top' : 'bottom';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.13);
    ctx.strokeStyle = '#000'; ctx.fillStyle = '#fff';
    const lh = size * 1.02;
    lines.forEach((l, i) => {
      const y = top ? h * 0.03 + i * lh : h * 0.97 - (lines.length - 1 - i) * lh;
      ctx.strokeText(l, w / 2, y); ctx.fillText(l, w / 2, y);
    });
  }
  function vhsStamp(ctx, w, h, amount, date) {
    const a = clamp((amount - 20) / 40, 0, 1);
    if (!a) return;
    const d = date || new Date(), size = Math.max(10, h * 0.062);
    const hh = d.getHours(), mm = String(d.getMinutes()).padStart(2, '0');
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `${size}px VT323, "Courier New", monospace`;
    ctx.fillStyle = '#ffb347'; ctx.shadowColor = 'rgba(255,140,40,.9)'; ctx.shadowBlur = size * 0.35;
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.fillText('▶ PLAY', w * 0.05, h * 0.06);
    ctx.textAlign = 'right';
    ctx.fillText('SP', w * 0.95, h * 0.06);
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${hh < 12 ? 'AM' : 'PM'} ${String(hh % 12 || 12).padStart(2, ' ')}:${mm}`, w * 0.95, h * 0.94 - size);
    ctx.fillText(`${MONTHS[d.getMonth()]}. ${String(d.getDate()).padStart(2, '0')} 1997`, w * 0.95, h * 0.94);
    ctx.restore();
  }
  /** Everything that lives above the ink: meme captions and, with enough VHS, the camcorder stamp. */
  function overlay(ctx, w, h, o) {
    if (!o) return;
    if ((o.vhs || 0) > 20) vhsStamp(ctx, w, h, o.vhs, o.date);
    if (o.meme && (o.meme.top || o.meme.bottom)) {
      ctx.save();
      memeBlock(ctx, o.meme.top, w, h, true);
      memeBlock(ctx, o.meme.bottom, w, h, false);
      ctx.restore();
    }
  }

  const STICKERS = ['😎', '😂', '🔥', '💯', '👌', '🗿', '🤡', '👀', '💀', '🥴', '🤌', '🐸', '🦆', '🍕', '✨', '💩', '🫠', '🙈', '🦊', '👑', '❤️', '⭐', '🌈', '🎉'];
  const FRY = ['😂', '👌', '💯', '🔥', '😳', '🅱️', '😩', '💦'];

  root.Fun = { ACHIEVEMENTS, cleanUnlocked, unlock, critic, VERDICTS, overlay, wrap, STICKERS, FRY, MEME_FONT };
})(typeof window !== 'undefined' ? window : globalThis);
