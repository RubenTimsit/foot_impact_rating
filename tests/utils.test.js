'use strict';

/**
 * utils.test.js — Tests des fonctions utilitaires (js/utils.js)
 *
 * Fonctions testées (copiées en CJS) :
 *  esc, formatDate, formatDateShort, formatDateInput,
 *  formatRating, deltaBadge, rcBadge, initiales, avatarHtml
 *
 * Scénarios couverts :
 *  ✅  esc : null/undefined, chaînes propres, XSS injection
 *  ✅  formatDate : null → "—", Date JS, timestamp Firestore, ISO string
 *  ✅  formatDateInput : conversion "YYYY-MM-DD" → texte français
 *  ✅  formatRating : 0, entiers positifs, NaN → 0, nombres avec virgule
 *  ✅  deltaBadge : positif, négatif, zéro, NaN
 *  ✅  rcBadge : classes CSS correctes selon signe
 *  ✅  initiales : nom simple, deux prénoms, nom vide, undefined
 *  ✅  avatarHtml : avec photo, sans photo (initiales), taille custom
 */

// ── Copie CJS des fonctions ───────────────────────────────────────────────────

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(ts, opts = {}) {
  if (!ts) return '—';
  let date;
  if (ts?.toDate)      date = ts.toDate();
  else if (ts?.seconds) date = new Date(ts.seconds * 1000);
  else if (ts instanceof Date) date = ts;
  else date = new Date(ts);

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    ...opts,
  });
}

function formatDateShort(ts) {
  return formatDate(ts, { day: 'numeric', month: 'short', year: undefined });
}

function formatDateInput(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatRating(n) {
  const val = Math.round(Number(n) || 0);
  return val.toLocaleString('fr-FR');
}

function deltaBadge(delta) {
  const n = Math.round(Number(delta) || 0);
  if (n > 0) return `<span class="delta-pos">+${n}</span>`;
  if (n < 0) return `<span class="delta-neg">${n}</span>`;
  return `<span class="delta-zero">±0</span>`;
}

function rcBadge(delta) {
  const n = Math.round(Number(delta) || 0);
  const cls = n > 0 ? 'pos' : n < 0 ? 'neg' : 'zer';
  const txt = n > 0 ? `+${n}` : n < 0 ? `${n}` : '±0';
  return `<span class="rc-badge ${cls}">${txt}</span>`;
}

function initiales(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return String(name).slice(0, 2).toUpperCase();
}

function avatarHtml(photoURL, displayName, size = 'md') {
  if (photoURL) {
    return `<div class="avatar avatar-${size}"><img src="${esc(photoURL)}" alt="${esc(displayName)}" loading="lazy"></div>`;
  }
  return `<div class="avatar avatar-${size}">${esc(initiales(displayName))}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — esc (échappement HTML)
// ─────────────────────────────────────────────────────────────────────────────

describe('esc', () => {
  test('null → chaîne vide', () => expect(esc(null)).toBe(''));
  test('undefined → chaîne vide', () => expect(esc(undefined)).toBe(''));
  test('chaîne normale inchangée', () => expect(esc('hello')).toBe('hello'));

  test('échappement <script> XSS', () => {
    expect(esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('& → &amp;', () => expect(esc('a & b')).toBe('a &amp; b'));
  test('" → &quot;', () => expect(esc('"quote"')).toBe('&quot;quote&quot;'));
  test("' → &#39;", () => expect(esc("don't")).toBe("don&#39;t"));

  test('injection attribut HTML', () => {
    const input = 'x" onmouseover="evil()';
    expect(esc(input)).not.toContain('"');
  });

  test('nombre converti en string', () => expect(esc(42)).toBe('42'));
  test('booléen converti en string', () => expect(esc(true)).toBe('true'));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — formatDate
// ─────────────────────────────────────────────────────────────────────────────

describe('formatDate', () => {
  test('null → "—"', () => expect(formatDate(null)).toBe('—'));
  test('undefined → "—"', () => expect(formatDate(undefined)).toBe('—'));
  test('0 → "—" (falsy)', () => expect(formatDate(0)).toBe('—'));

  test('Date JS → string non vide', () => {
    const d = new Date(2024, 0, 15); // 15 jan 2024
    const result = formatDate(d);
    expect(result).toContain('2024');
    expect(result.toLowerCase()).toContain('janv');
  });

  test('ISO string → formaté', () => {
    const result = formatDate('2024-06-10T00:00:00');
    expect(result).toContain('2024');
  });

  test('timestamp Firestore simulé {seconds} → formaté', () => {
    const tsFirestore = { seconds: new Date(2024, 5, 10).getTime() / 1000 };
    const result = formatDate(tsFirestore);
    expect(result).toContain('2024');
  });

  test('objet avec .toDate() → formaté', () => {
    const fakeFirestore = { toDate: () => new Date(2025, 3, 1) };
    const result = formatDate(fakeFirestore);
    expect(result).toContain('2025');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — formatDateInput
// ─────────────────────────────────────────────────────────────────────────────

describe('formatDateInput', () => {
  test('null → "—"', () => expect(formatDateInput(null)).toBe('—'));
  test('"" → "—"', () => expect(formatDateInput('')).toBe('—'));

  test('format YYYY-MM-DD → texte français', () => {
    const result = formatDateInput('2024-01-15');
    expect(result).toContain('2024');
    expect(result.toLowerCase()).toContain('janv');
    expect(result).toContain('15');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — formatRating
// ─────────────────────────────────────────────────────────────────────────────

describe('formatRating', () => {
  test('0 → "0"', () => expect(formatRating(0)).toBe('0'));
  test('1000 → formaté (au moins "1")', () => {
    const r = formatRating(1000);
    expect(r).toMatch(/1[\s\u202f]?000|1000/); // espace insécable ou pas selon locale
  });
  test('NaN → "0"', () => expect(formatRating(NaN)).toBe('0'));
  test('undefined → "0"', () => expect(formatRating(undefined)).toBe('0'));
  test('float arrondi : 1050.6 → 1051', () => {
    const r = formatRating(1050.6);
    // La locale fr-FR peut utiliser un espace insécable (\u202f) ou régulier comme séparateur
    expect(r.replace(/[\u202f\u00a0 ]/g, '')).toBe('1051');
  });
  test('valeur négative formatée', () => {
    const r = formatRating(-50);
    expect(r).toContain('50');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — deltaBadge
// ─────────────────────────────────────────────────────────────────────────────

describe('deltaBadge', () => {
  test('positif → classe delta-pos et signe +', () => {
    const html = deltaBadge(15);
    expect(html).toContain('delta-pos');
    expect(html).toContain('+15');
  });

  test('négatif → classe delta-neg sans signe +', () => {
    const html = deltaBadge(-8);
    expect(html).toContain('delta-neg');
    expect(html).toContain('-8');
    expect(html).not.toContain('+');
  });

  test('zéro → classe delta-zero et ±0', () => {
    const html = deltaBadge(0);
    expect(html).toContain('delta-zero');
    expect(html).toContain('±0');
  });

  test('NaN → traité comme zéro', () => {
    expect(deltaBadge(NaN)).toContain('delta-zero');
  });

  test('float arrondi : 4.7 → +5', () => {
    expect(deltaBadge(4.7)).toContain('+5');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — rcBadge
// ─────────────────────────────────────────────────────────────────────────────

describe('rcBadge', () => {
  test('positif → classe "pos"', () => expect(rcBadge(10)).toContain('rc-badge pos'));
  test('négatif → classe "neg"', () => expect(rcBadge(-5)).toContain('rc-badge neg'));
  test('zéro → classe "zer"', () => expect(rcBadge(0)).toContain('rc-badge zer'));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 7 — initiales
// ─────────────────────────────────────────────────────────────────────────────

describe('initiales', () => {
  test('null → "?"', () => expect(initiales(null)).toBe('?'));
  test('undefined → "?"', () => expect(initiales(undefined)).toBe('?'));
  test('"" → "?"', () => expect(initiales('')).toBe('?'));

  test('prénom seul → 2 premières lettres en majuscule', () => {
    expect(initiales('alice')).toBe('AL');
  });

  test('prénom + nom → première lettre de chaque', () => {
    expect(initiales('Alice Dupont')).toBe('AD');
  });

  test('3 mots → première lettre du premier et du dernier', () => {
    expect(initiales('Jean Pierre Martin')).toBe('JM');
  });

  test('déjà en majuscule', () => {
    expect(initiales('Bob Smith')).toBe('BS');
  });

  test('espaces multiples ignorés', () => {
    expect(initiales('  Alice   Martin  ')).toBe('AM');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 8 — avatarHtml
// ─────────────────────────────────────────────────────────────────────────────

describe('avatarHtml', () => {
  test('sans photo → affiche les initiales', () => {
    const html = avatarHtml(null, 'Alice Dupont');
    expect(html).toContain('AD');
    expect(html).not.toContain('<img');
  });

  test('avec photoURL → affiche un <img>', () => {
    const html = avatarHtml('https://example.com/photo.jpg', 'Bob');
    expect(html).toContain('<img');
    expect(html).toContain('https://example.com/photo.jpg');
  });

  test('taille par défaut = "md"', () => {
    expect(avatarHtml(null, 'Test')).toContain('avatar-md');
  });

  test('taille custom "lg"', () => {
    expect(avatarHtml(null, 'Test', 'lg')).toContain('avatar-lg');
  });

  test('l\'URL est correctement échappée (XSS)', () => {
    const html = avatarHtml('"><img src=x onerror=evil()>', 'Bob');
    // Les caractères < et > doivent être échappés → pas d'injection de balise réelle
    expect(html).not.toContain('<img src=x');          // pas de balise HTML brute
    expect(html).toContain('&lt;img src=x');           // version échappée présente
    expect(html).toContain('&quot;');                  // le " est bien échappé
  });
});
