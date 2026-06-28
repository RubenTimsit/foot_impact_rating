'use strict';
/**
 * generate-memo-elo.js — v2
 * Memo PDF systeme ELO. Utilise uniquement des caracteres ASCII
 * compatibles Helvetica (pas de x, Delta, fleches Unicode).
 *
 * Usage : cd tests && node generate-memo-elo.js
 */

const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');

const C = {
  dark:   '#1a1a2e',
  accent: '#2563eb',
  green:  '#16a34a',
  red:    '#dc2626',
  orange: '#ea580c',
  gray:   '#6b7280',
  light:  '#f1f5f9',
  white:  '#ffffff',
  border: '#e2e8f0',
  blue2:  '#eff6ff',
};

// Donnees du match
const SPLIT = [0.667, 0.333];
const K     = 64;

function prob(rA, rB) { return 1 / (1 + Math.pow(10, (rB - rA) / 400)); }
function mult(s1, s2) { return 1 + Math.abs(s1 - s2) / 6; }
function moy(arr)     { return arr.reduce((s, v) => s + v, 0) / arr.length; }

const rMoyA1 = 1000, rMoyB1 = 1000;
const pA1    = prob(rMoyA1, rMoyB1);           // 0.5
const m1     = mult(6, 2);                      // 1.667
const kP1    = K * SPLIT[0];                    // 42.667
const dA1    = Math.round(kP1 * (1 - pA1) * m1);  // +36
const dB1    = Math.round(kP1 * (0 - pA1) * m1);  // -36

const eqA2r = [1036,1036,1036,1036,1036,1036,964,1036];
const eqB2r = [1036,964,964,964,964,964,964,964];
const rMoyA2 = moy(eqA2r); // ~1027
const rMoyB2 = moy(eqB2r); // ~973
const pA2    = prob(rMoyA2, rMoyB2);
const m2     = mult(2, 3);                      // 1.167
const kP2    = K * SPLIT[1];                    // 21.333
const dA2    = Math.round(kP2 * (0 - pA2) * m2);   // -14  (A perd : 0 - P(A gagne))
const dB2    = Math.round(kP2 * (1 - (1 - pA2)) * m2); // +14  (B gagne : 1 - P(B gagne) = P(A gagne))

const RESULTATS = [
  { nom:'Ruben Timsit',      avant:1000, d1:+dA1, d2:+dB2, delta:+50, apres:1050, sm1:'victoire', sm2:'victoire', final:'VICTOIRE' },
  { nom:'Benjamin S',        avant:1000, d1:+dA1, d2:+dA2, delta:+22, apres:1022, sm1:'victoire', sm2:'defaite',  final:'VICTOIRE' },
  { nom:'Sambo',             avant:1000, d1:+dA1, d2:+dA2, delta:+22, apres:1022, sm1:'victoire', sm2:'defaite',  final:'VICTOIRE' },
  { nom:'Ilan Teboul',       avant:1000, d1:+dA1, d2:+dA2, delta:+22, apres:1022, sm1:'victoire', sm2:'defaite',  final:'VICTOIRE' },
  { nom:'Adamax',            avant:1000, d1:+dA1, d2:+dA2, delta:+22, apres:1022, sm1:'victoire', sm2:'defaite',  final:'VICTOIRE' },
  { nom:'Benjamin Amsellem', avant:1000, d1:+dA1, d2:+dA2, delta:+22, apres:1022, sm1:'victoire', sm2:'defaite',  final:'VICTOIRE' },
  { nom:'Elie Memmi',        avant:1000, d1:+dA1, d2:+dA2, delta:+22, apres:1022, sm1:'victoire', sm2:'defaite',  final:'VICTOIRE' },
  { nom:'Jeremy Levy',       avant:1000, d1:+dA1, d2:+dA2, delta:+22, apres:1022, sm1:'victoire', sm2:'defaite',  final:'VICTOIRE' },
  { nom:'Liam',              avant:1000, d1:+dB1, d2:+dB2, delta:-22, apres: 978, sm1:'defaite',  sm2:'victoire', final:'DEFAITE'  },
  { nom:'Noe Sroussi',       avant:1000, d1:+dB1, d2:+dB2, delta:-22, apres: 978, sm1:'defaite',  sm2:'victoire', final:'DEFAITE'  },
  { nom:'Ruben Sayada',      avant:1000, d1:+dB1, d2:+dB2, delta:-22, apres: 978, sm1:'defaite',  sm2:'victoire', final:'DEFAITE'  },
  { nom:'Koubz',             avant:1000, d1:+dB1, d2:+dB2, delta:-22, apres: 978, sm1:'defaite',  sm2:'victoire', final:'DEFAITE'  },
  { nom:'Ariel',             avant:1000, d1:+dB1, d2:+dB2, delta:-22, apres: 978, sm1:'defaite',  sm2:'victoire', final:'DEFAITE'  },
  { nom:'Isaac Leyne',       avant:1000, d1:+dB1, d2:+dA2, delta:-50, apres: 950, sm1:'defaite',  sm2:'defaite',  final:'DEFAITE'  },
  { nom:'Avner',             avant:1000, d1:+dB1, d2:+dB2, delta:-22, apres: 978, sm1:'defaite',  sm2:'victoire', final:'DEFAITE'  },
  { nom:'Jeremie',           avant:1000, d1:+dB1, d2:+dB2, delta:-22, apres: 978, sm1:'defaite',  sm2:'victoire', final:'DEFAITE'  },
];

// ── PDF ───────────────────────────────────────────────────────
const OUT = path.join(__dirname, '..', 'memo-systeme-elo.pdf');
const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 50, bottom: 60, left: 50, right: 50 },
  bufferPages: true,
  info: { Title: 'Memo Systeme ELO - Roslan FC', Author: 'Impact Rating App' },
});
doc.pipe(fs.createWriteStream(OUT));

const PW  = doc.page.width;   // 595
const PH  = doc.page.height;  // 842
const ML  = 50;
const W   = PW - 100;

// ── Helpers ───────────────────────────────────────────────────

function footer() {
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    doc.save();
    doc.rect(0, PH - 40, PW, 40).fill('#f8fafc');
    doc.fillColor(C.gray).fontSize(8).font('Helvetica')
       .text(
         `Impact Rating App  |  ROSLAN FC  |  Memo ELO  |  Page ${i+1} / ${total}`,
         ML, PH - 26, { width: W, align: 'center' }
       );
    doc.restore();
  }
}

// Verifie si on a assez de place, sinon nouvelle page
function ensureSpace(needed, y) {
  if (y + needed > PH - 70) {
    doc.addPage();
    return 50;
  }
  return y;
}

function sectionHeader(title, y) {
  y = ensureSpace(34, y);
  doc.rect(ML, y, W, 28).fill(C.accent);
  doc.fillColor(C.white).fontSize(12).font('Helvetica-Bold')
     .text(title, ML + 12, y + 8, { width: W - 20 });
  return y + 36;
}

function subHead(title, y) {
  y = ensureSpace(20, y);
  doc.fillColor(C.dark).fontSize(10.5).font('Helvetica-Bold')
     .text(title, ML, y, { width: W });
  return y + 18;
}

function body(text, y, indent) {
  y = ensureSpace(20, y);
  const x = ML + (indent || 0);
  doc.fillColor(C.dark).fontSize(9.5).font('Helvetica')
     .text(text, x, y, { width: W - (indent || 0), lineGap: 2 });
  return doc.y + 5;
}

function formulaBox(lines, y) {
  const lineH = 16;
  const h = 14 + lines.length * lineH;
  y = ensureSpace(h + 8, y);
  doc.rect(ML, y, W, h).fill(C.blue2);
  doc.rect(ML, y, 4, h).fill(C.accent);
  lines.forEach((line, i) => {
    doc.fillColor(C.accent).fontSize(9).font('Helvetica-Bold')
       .text(line, ML + 12, y + 8 + i * lineH, { width: W - 20 });
  });
  return y + h + 8;
}

function infoBox(title, text, y, bgColor, barColor) {
  const lines = text.split('\n');
  const h = 16 + 14 + lines.length * 14;
  y = ensureSpace(h + 6, y);
  doc.roundedRect(ML, y, W, h, 5).fill(bgColor);
  doc.rect(ML, y, 4, h).fill(barColor);
  doc.fillColor(barColor).fontSize(9).font('Helvetica-Bold')
     .text(title, ML + 12, y + 8, { width: W - 20 });
  lines.forEach((line, i) => {
    doc.fillColor(C.dark).fontSize(9).font('Helvetica')
       .text(line, ML + 12, y + 22 + i * 14, { width: W - 20 });
  });
  return y + h + 8;
}

// ═══════════════════════════════════════════════════════════
// PAGE 1 — COUVERTURE + SECTION 1
// ═══════════════════════════════════════════════════════════

// Banniere
doc.rect(0, 0, PW, 180).fill(C.dark);
doc.fillColor(C.white).fontSize(24).font('Helvetica-Bold')
   .text('Memo — Systeme de Rating ELO', ML, 50, { width: W, align: 'center' });
doc.fillColor('#93c5fd').fontSize(13).font('Helvetica')
   .text('Impact Rating App  |  ROSLAN FC', ML, 88, { width: W, align: 'center' });
doc.fillColor('#64748b').fontSize(9).font('Helvetica')
   .text('Soiree du 04/06/2026  |  Match ID : m8eekUNj2Ei2HDljKNNS', ML, 112, { width: W, align: 'center' });

// 3 cartes recap
const cW = (W - 20) / 3;
[[0,'K-Factor','64',C.accent],[cW+10,'Rating base','1000',C.dark],[cW*2+20,'Joueurs','16',C.green]]
  .forEach(([dx, label, val, col]) => {
    doc.roundedRect(ML + dx, 148, cW, 56, 6).fill(C.light);
    doc.fillColor(C.gray).fontSize(8.5).font('Helvetica')
       .text(label, ML + dx, 158, { width: cW, align: 'center' });
    doc.fillColor(col).fontSize(24).font('Helvetica-Bold')
       .text(val, ML + dx, 172, { width: cW, align: 'center' });
  });

let y = 222;

// Section 1
y = sectionHeader('1.  Principe du systeme ELO', y);
y = body('Le systeme ELO est une methode de classement numerique. Chaque joueur possede un score (le "rating").', y);
y = body('Apres chaque match, ce score monte ou descend selon deux facteurs :', y);
y = body('  - Le resultat (victoire / nul / defaite)', y);
y = body('  - La probabilite attendue : battre une equipe plus forte rapporte plus que battre une equipe plus faible.', y);
y += 6;

y = subHead('Formule de base', y);
y = formulaBox([
  'Delta_rating  =  K  *  (resultat - probabilite_attendue)  *  multiplicateur_score',
], y);

y = body('Parametres :', y);
y = body('  K = 64  (constante d\'ajustement — plus elle est grande, plus les changements sont rapides)', y);
y = body('  resultat  =  1 (victoire)  /  0.5 (nul)  /  0 (defaite)', y);
y = body('  probabilite_attendue  =  1 / (1 + 10^( (rating_B - rating_A) / 400 ))', y);
y = body('  multiplicateur_score  =  1 + |score_A - score_B| / 6    (victoire large => gain amplifie)', y);
y += 6;

y = subHead('Limites de securite', y);
y = body('Le delta est toujours plafonne entre -150 et +150 pts pour eviter les variations catastrophiques.', y);
y += 8;

// Section 2
y = sectionHeader('2.  Mode Soiree — 2 sous-matchs', y);
y = body('Quand l\'admin active le "mode soiree", la soiree comporte 2 sous-matchs avec reeequilibrage des equipes.', y);
y = body('Le calcul ELO se fait en 2 passes sequentielles :', y);
y = body('  Passe 1 : on calcule les deltas du SM1 et on met a jour les ratings courants.', y);
y = body('  Passe 2 : on calcule les deltas du SM2 en utilisant les ratings post-SM1.', y);
y += 6;

y = subHead('Poids (split)', y);
y = body('L\'admin assigne un poids a chaque sous-match. Ce soir : split = [0.667, 0.333]', y);
y = body('Le 1er sous-match compte double. K est proportionne a ce poids :', y);
y = formulaBox([
  'K_pondere  =  K_FACTOR * poids',
  'SM1 : 64 * 0.667 = 42.7    |    SM2 : 64 * 0.333 = 21.3',
], y);
y += 6;

y = subHead('Resultat synthetique pour les stats V/N/D', y);
y = body('Une soiree = 1 seul "match" dans les stats. Le resultat final est determine par un score pondere :', y);
y = formulaBox([
  'score_pondere  =  resultat_SM1 * poids1  +  resultat_SM2 * poids2',
  '(victoire=1, nul=0.5, defaite=0)',
  '  > 0.6  =>  VICTOIRE    |    < 0.4  =>  DEFAITE    |    entre 0.4 et 0.6  =>  NUL',
], y);

// ═══════════════════════════════════════════════════════════
// PAGE 2 — CALCUL SM1
// ═══════════════════════════════════════════════════════════
doc.addPage();
y = 50;

y = sectionHeader('3.  Calcul detaille — Sous-match 1  (poids 0.667,  score 6-2)', y);

// Tableau equipes SM1
const eqA1_noms = ['Ruben Timsit','Benjamin S','Sambo','Ilan Teboul','Adamax','Benjamin Amsellem','Elie Memmi','Jeremy Levy'];
const eqB1_noms = ['Liam','Noe Sroussi','Ruben Sayada','Koubz','Ariel','Isaac Leyne','Avner','Jeremie'];

function drawTeamTable2col(nomA, nomB, scoreA, scoreB, headerA, headerB, y) {
  const colW = (W - 80) / 2;
  const scoreW = 80;
  const rowH = 18;
  const hdrH = 24;
  const totalH = hdrH + nomA.length * rowH;

  // En-tetes
  doc.rect(ML, y, colW, hdrH).fill(C.accent);
  doc.rect(ML + colW, y, scoreW, hdrH).fill(C.dark);
  doc.rect(ML + colW + scoreW, y, colW, hdrH).fill(C.red);
  doc.fillColor(C.white).fontSize(9.5).font('Helvetica-Bold')
     .text(headerA, ML, y + 7, { width: colW, align: 'center' })
     .text('Score', ML + colW, y + 7, { width: scoreW, align: 'center' })
     .text(headerB, ML + colW + scoreW, y + 7, { width: colW, align: 'center' });

  nomA.forEach((n, i) => {
    const ry = y + hdrH + i * rowH;
    const bg = i % 2 === 0 ? '#f8fafc' : C.white;
    doc.rect(ML, ry, colW, rowH).fill(bg);
    doc.rect(ML + colW, ry, scoreW, rowH).fill(bg);
    doc.rect(ML + colW + scoreW, ry, colW, rowH).fill(bg);
    doc.fillColor(C.dark).fontSize(8.5).font('Helvetica')
       .text(n,        ML + 6,              ry + 4, { width: colW - 10 })
       .text(nomB[i],  ML + colW + scoreW + 6, ry + 4, { width: colW - 10 });
    if (i === 3) {
      doc.fillColor(C.green).fontSize(20).font('Helvetica-Bold')
         .text(String(scoreA), ML + colW,      ry - 10, { width: 30, align: 'right' });
      doc.fillColor(C.gray).fontSize(12).font('Helvetica')
         .text('-', ML + colW + 32, ry - 4);
      doc.fillColor(C.red).fontSize(20).font('Helvetica-Bold')
         .text(String(scoreB), ML + colW + 46, ry - 10, { width: 30 });
    }
  });
  // Bordure
  doc.rect(ML, y, W, totalH).stroke(C.border);
  doc.moveTo(ML + colW, y).lineTo(ML + colW, y + totalH).stroke(C.border);
  doc.moveTo(ML + colW + scoreW, y).lineTo(ML + colW + scoreW, y + totalH).stroke(C.border);
  return y + totalH + 10;
}

y = drawTeamTable2col(eqA1_noms, eqB1_noms, 6, 2, 'Equipe A', 'Equipe B', y);

y = subHead('Etapes du calcul — SM1', y);
y = formulaBox([
  'Rating moyen A = 1000  |  Rating moyen B = 1000  (tous debutent a 1000)',
], y);
y = formulaBox([
  'Prob. victoire A = 1 / (1 + 10^( (1000-1000)/400 )) = 1 / (1+1) = 0.500',
], y);
y = formulaBox([
  'Multiplicateur = 1 + |6-2| / 6 = 1 + 0.667 = 1.667',
], y);
y = formulaBox([
  `K pondere = 64 * 0.667 = 42.7`,
], y);
y = formulaBox([
  `Delta Equipe A (victoire) = round( 42.7 * (1 - 0.500) * 1.667 ) = round(35.6) = +${dA1}`,
  `Delta Equipe B (defaite)  = round( 42.7 * (0 - 0.500) * 1.667 ) = round(-35.6) = ${dB1}`,
], y);
y = body(`=> Apres SM1 : joueurs Eq. A passent de 1000 a ${1000+dA1}  |  joueurs Eq. B passent de 1000 a ${1000+dB1}`, y);

// ═══════════════════════════════════════════════════════════
// PAGE 3 — CALCUL SM2
// ═══════════════════════════════════════════════════════════
doc.addPage();
y = 50;

y = sectionHeader('4.  Calcul detaille — Sous-match 2  (poids 0.333,  score 2-3)', y);

y = body('Les equipes ont ete reeequilibrees. Les ratings utilises sont ceux POST-SM1 :', y);
y += 4;

const eqA2_data = [
  ['Benjamin S',        1036], ['Sambo',         1036], ['Ilan Teboul',     1036], ['Adamax',     1036],
  ['Benjamin Amsellem', 1036], ['Elie Memmi',    1036], ['Isaac Leyne',      964], ['Jeremy Levy',1036],
];
const eqB2_data = [
  ['Ruben Timsit',  1036], ['Liam',      964], ['Noe Sroussi', 964], ['Ruben Sayada', 964],
  ['Koubz',          964], ['Ariel',     964], ['Avner',       964], ['Jeremie',      964],
];

function drawTeamTable2colWithRating(dataA, dataB, scoreA, scoreB, y) {
  const colW = (W - 80) / 2;
  const scoreW = 80;
  const rowH = 18;
  const hdrH = 24;
  const totalH = hdrH + dataA.length * rowH;

  doc.rect(ML, y, colW, hdrH).fill(C.accent);
  doc.rect(ML + colW, y, scoreW, hdrH).fill(C.dark);
  doc.rect(ML + colW + scoreW, y, colW, hdrH).fill(C.red);
  doc.fillColor(C.white).fontSize(9.5).font('Helvetica-Bold')
     .text('Equipe A (post-SM1)', ML, y + 7, { width: colW, align: 'center' })
     .text('Score', ML + colW, y + 7, { width: scoreW, align: 'center' })
     .text('Equipe B (post-SM1)', ML + colW + scoreW, y + 7, { width: colW, align: 'center' });

  dataA.forEach(([nom, r], i) => {
    const [nomB, rB] = dataB[i];
    const ry = y + hdrH + i * rowH;
    const bg = i % 2 === 0 ? '#f8fafc' : C.white;
    doc.rect(ML, ry, colW, rowH).fill(bg);
    doc.rect(ML + colW, ry, scoreW, rowH).fill(bg);
    doc.rect(ML + colW + scoreW, ry, colW, rowH).fill(bg);
    const rColor = r > 1000 ? C.green : r < 1000 ? C.red : C.gray;
    const rColorB = rB > 1000 ? C.green : rB < 1000 ? C.red : C.gray;
    doc.fillColor(C.dark).fontSize(8).font('Helvetica')
       .text(nom, ML + 4, ry + 4, { width: colW * 0.65 });
    doc.fillColor(rColor).fontSize(8).font('Helvetica-Bold')
       .text(`(${r})`, ML + colW * 0.67, ry + 4, { width: colW * 0.3 });
    doc.fillColor(C.dark).fontSize(8).font('Helvetica')
       .text(nomB, ML + colW + scoreW + 4, ry + 4, { width: colW * 0.65 });
    doc.fillColor(rColorB).fontSize(8).font('Helvetica-Bold')
       .text(`(${rB})`, ML + colW + scoreW + colW * 0.67, ry + 4, { width: colW * 0.3 });
    if (i === 3) {
      doc.fillColor(C.red).fontSize(20).font('Helvetica-Bold')
         .text(String(scoreA), ML + colW,      ry - 10, { width: 30, align: 'right' });
      doc.fillColor(C.gray).fontSize(12).font('Helvetica').text('-', ML + colW + 32, ry - 4);
      doc.fillColor(C.green).fontSize(20).font('Helvetica-Bold')
         .text(String(scoreB), ML + colW + 46, ry - 10, { width: 30 });
    }
  });
  doc.rect(ML, y, W, totalH).stroke(C.border);
  doc.moveTo(ML + colW, y).lineTo(ML + colW, y + totalH).stroke(C.border);
  doc.moveTo(ML + colW + scoreW, y).lineTo(ML + colW + scoreW, y + totalH).stroke(C.border);
  return y + totalH + 10;
}

y = drawTeamTable2colWithRating(eqA2_data, eqB2_data, 2, 3, y);

y = subHead('Etapes du calcul — SM2  (ratings mis a jour apres SM1)', y);
y = formulaBox([
  `Rating moyen A = (1036*7 + 964) / 8 = ${Math.round(rMoyA2)}`,
  `Rating moyen B = (1036 + 964*7) / 8 = ${Math.round(rMoyB2)}`,
], y);
y = formulaBox([
  `P(A gagne) = 1 / (1 + 10^( (${Math.round(rMoyB2)}-${Math.round(rMoyA2)})/400 )) = ${pA2.toFixed(3)}`,
  `P(B gagne) = 1 - ${pA2.toFixed(3)} = ${(1-pA2).toFixed(3)}`,
  `L'equipe A est FAVORITE => P(A gagne) > 0.5. Chaque equipe utilise SA propre probabilite.`,
], y);
y = formulaBox([
  'Multiplicateur = 1 + |2-3| / 6 = 1 + 0.167 = 1.167  (ecart faible => gain moindre)',
], y);
y = formulaBox([
  `K pondere = 64 * 0.333 = 21.3`,
], y);
const pB2 = 1 - pA2; // P(B gagne) = 0.423
y = formulaBox([
  `Delta Equipe A (defaite)  = round( 21.3 * (0 - P(A gagne)) * 1.167 )`,
  `                          = round( 21.3 * (0 - ${pA2.toFixed(3)}) * 1.167 ) = round(${(kP2*(0-pA2)*m2).toFixed(1)}) = ${dA2}`,
  `Delta Equipe B (victoire) = round( 21.3 * (1 - P(B gagne)) * 1.167 )`,
  `                          = round( 21.3 * (1 - ${pB2.toFixed(3)}) * 1.167 ) = round(${(kP2*(1-pB2)*m2).toFixed(1)}) = +${dB2}`,
  `=> Symetrie ELO : |deltaA| = |deltaB| = ${Math.abs(dA2)}  (le vainqueur gagne exactement ce que le perdant perd)`,
], y);
y = body(`=> Apres SM2 : joueurs Eq. A : ${1036+dA2} (${dA2})  |  joueurs Eq. B : ${964+dB2} (+${dB2})  |  delta symetrique : +-${Math.abs(dA2)} pts`, y);

// ═══════════════════════════════════════════════════════════
// PAGE 4 — RESULTATS FINAUX
// ═══════════════════════════════════════════════════════════
doc.addPage();
y = 50;

y = sectionHeader('5.  Resultats finaux  —  Cumul SM1 + SM2', y);

y = body('Le delta total = delta SM1 + delta SM2. Le resultat V/N/D est determine par le score pondere :', y);
y = formulaBox([
  'score_pondere  =  resultat_SM1 * 0.667  +  resultat_SM2 * 0.333',
  '(victoire=1, nul=0.5, defaite=0)    =>    >0.6 VICTOIRE | <0.4 DEFAITE | sinon NUL',
], y);
y += 4;

// Tableau resultats
const colW_nom  = 130;
const colW_num  = (W - colW_nom - 80) / 5;
const colW_res  = 80;
const hdrs = ['Joueur','Avant','D SM1','D SM2','D Total','Apres','Resultat'];
const cws  = [colW_nom, colW_num, colW_num, colW_num, colW_num, colW_num, colW_res];

// En-tete
let xh = ML;
hdrs.forEach((h, i) => {
  doc.rect(xh, y, cws[i], 22).fill(C.dark);
  doc.fillColor(C.white).fontSize(8.5).font('Helvetica-Bold')
     .text(h, xh + 3, y + 7, { width: cws[i] - 4, align: i === 0 ? 'left' : 'center' });
  xh += cws[i];
});
y += 22;

RESULTATS.forEach((r, i) => {
  const bg = i % 2 === 0 ? '#f8fafc' : C.white;
  let xr = ML;
  const rowH = 17;
  cws.forEach(cw => { doc.rect(xr, y, cw, rowH).fill(bg); xr += cw; });

  const d1Str = (r.d1 >= 0 ? '+' : '') + r.d1;
  const d2Str = (r.d2 >= 0 ? '+' : '') + r.d2;
  const dtStr = (r.delta >= 0 ? '+' : '') + r.delta;
  const resColor = r.final === 'VICTOIRE' ? C.green : C.red;

  const cells = [
    { v: r.nom,   color: C.dark,  bold: false, align: 'left' },
    { v: r.avant, color: C.gray,  bold: false, align: 'center' },
    { v: d1Str,   color: r.d1>=0?C.green:C.red, bold: true, align: 'center' },
    { v: d2Str,   color: r.d2>=0?C.green:C.red, bold: true, align: 'center' },
    { v: dtStr,   color: r.delta>=0?C.green:C.red, bold: true, align: 'center' },
    { v: r.apres, color: C.dark,  bold: true,  align: 'center' },
    { v: r.final, color: resColor,bold: true,  align: 'center' },
  ];

  let xv = ML;
  cells.forEach((cell, ci) => {
    doc.fillColor(cell.color).fontSize(8)
       .font(cell.bold ? 'Helvetica-Bold' : 'Helvetica')
       .text(String(cell.v), xv + 3, y + 5, { width: cws[ci] - 4, align: cell.align });
    xv += cws[ci];
  });
  y += rowH;
});
doc.rect(ML, y - RESULTATS.length * 17, W, RESULTATS.length * 17).stroke(C.border);

y += 14;

// Cas particuliers
y = subHead('Cas particuliers', y);

y = infoBox(
  'Isaac Leyne — Double defaite (-50 pts)',
  'SM1 : equipe B => DEFAITE (+' + dB1 + ')\n' +
  'SM2 : equipe A => DEFAITE (' + dA2 + ')\n' +
  'Score pondere = 0*0.667 + 0*0.333 = 0.0 < 0.4 => DEFAITE',
  y, '#fef2f2', C.red
);

y = infoBox(
  'Ruben Timsit — Double victoire (+50 pts)',
  'SM1 : equipe A => VICTOIRE (+' + dA1 + ')\n' +
  'SM2 : equipe B => VICTOIRE (+' + dB2 + ')   [note : delta symetrique avec eq. A qui perd ' + dA2 + ']\n' +
  'Total : +' + dA1 + ' + ' + dB2 + ' = +' + (dA1 + dB2) + '\n' +
  'Score pondere = 1*0.667 + 1*0.333 = 1.0 > 0.6 => VICTOIRE',
  y, '#f0fdf4', C.green
);

y = infoBox(
  'Benjamin S (et 6 autres) — 1 victoire + 1 defaite (+22 pts)',
  'SM1 : equipe A => VICTOIRE (+' + dA1 + ')\n' +
  'SM2 : equipe A => DEFAITE (' + dA2 + ')\n' +
  'Score pondere = 1*0.667 + 0*0.333 = 0.667 > 0.6 => VICTOIRE\n' +
  'Raison : le 1er sous-match (poids 0.667) compte plus que le 2e (poids 0.333)',
  y, '#fffbeb', C.orange
);

// ═══════════════════════════════════════════════════════════
// PAGE 5 — REGLES & SCHEMA
// ═══════════════════════════════════════════════════════════
doc.addPage();
y = 50;

y = sectionHeader('6.  Tableau des parametres du systeme', y);

const rules = [
  ['K-Factor',           '64',          'Amplitude des variations. Plus grand = classement evolue plus vite.'],
  ['Rating de base',     '1000',         'Rating initial de tout nouveau joueur.'],
  ['Gain maximum',       '+150 pts',     'Plafond par match pour eviter les gains abusifs.'],
  ['Perte maximum',      '-150 pts',     'Plancher par match pour eviter les chutes catastrophiques.'],
  ['1 soiree = 1 match', 'oui',          'Meme avec 2 sous-matchs, matchsJoues augmente de 1 seulement.'],
  ['Split par defaut',   '[0.5, 0.5]',   'Chaque sous-match vaut 50%. L\'admin peut changer (ex: [0.667, 0.333]).'],
  ['Seuil victoire',     '> 0.6',        'Score pondere > 0.6 => Victoire dans les stats.'],
  ['Seuil nul',          '0.4 a 0.6',    'Score pondere entre 0.4 et 0.6 => Nul dans les stats.'],
  ['Seuil defaite',      '< 0.4',        'Score pondere < 0.4 => Defaite dans les stats.'],
  ['Calcul sequentiel',  'SM1 puis SM2', 'Les ratings du SM2 tiennent compte des deltas du SM1.'],
];

const rcols = [115, 85, W - 200];
let xhh = ML;
['Parametre', 'Valeur', 'Description'].forEach((h, i) => {
  doc.rect(xhh, y, rcols[i], 22).fill(C.dark);
  doc.fillColor(C.white).fontSize(9).font('Helvetica-Bold').text(h, xhh + 6, y + 7);
  xhh += rcols[i];
});
y += 22;
rules.forEach(([p, v, d], i) => {
  const bg = i % 2 === 0 ? '#f8fafc' : C.white;
  let xr = ML;
  [p, v, d].forEach((cell, ci) => {
    doc.rect(xr, y, rcols[ci], 20).fill(bg);
    doc.fillColor(ci === 1 ? C.accent : C.dark)
       .fontSize(8.5).font(ci === 1 ? 'Helvetica-Bold' : 'Helvetica')
       .text(cell, xr + 6, y + 6, { width: rcols[ci] - 10 });
    xr += rcols[ci];
  });
  y += 20;
});
doc.rect(ML, y - rules.length * 20, W, rules.length * 20).stroke(C.border);
y += 16;

// Section schema
y = sectionHeader('7.  Schema de traitement d\'une soiree', y + 4);
y = body('Le calcul se deroule en 4 etapes sequentielles :', y);
y += 8;

const boxes = [
  { label: '1. Admin saisit\nequipes & scores',  sub: 'SM1 + SM2', color: C.accent },
  { label: '2. Calcul ELO\nSM1 (K*poids1)',      sub: 'ratings mis a jour', color: C.orange },
  { label: '3. Calcul ELO\nSM2 (K*poids2)',      sub: 'utilise ratings post-SM1', color: C.orange },
  { label: '4. Resultat\nsynthetique + save',     sub: 'V/N/D + delta total', color: C.green },
];

const bW2 = (W - 30) / 4;
const bH  = 56;
boxes.forEach((box, i) => {
  const bx = ML + i * (bW2 + 10);
  doc.roundedRect(bx, y, bW2, bH, 5).fill(box.color);
  doc.fillColor(C.white).fontSize(8.5).font('Helvetica-Bold')
     .text(box.label, bx + 6, y + 8, { width: bW2 - 12 });
  doc.fillColor('#dde9ff').fontSize(7.5).font('Helvetica')
     .text(box.sub, bx + 6, y + 36, { width: bW2 - 12 });

  if (i < 3) {
    const ax = bx + bW2 + 2;
    const ay = y + bH / 2;
    doc.moveTo(ax, ay).lineTo(ax + 6, ay).strokeColor('#94a3b8').lineWidth(1.5).stroke();
    doc.moveTo(ax + 6, ay).lineTo(ax + 2, ay - 4).stroke();
    doc.moveTo(ax + 6, ay).lineTo(ax + 2, ay + 4).stroke();
  }
});
y += bH + 14;

// Note de verification
y = infoBox(
  'Verification automatique',
  'Le script audit-roslan-soiree.js recharge les donnees depuis Firestore et recalcule\n' +
  'chaque delta manuellement. Ce soir : 16/16 joueurs corrects — aucun ecart detecte.',
  y + 4, '#f0fdf4', C.green
);

// ── Footers ───────────────────────────────────────────────────
footer();

doc.end();
console.log('PDF genere : ' + OUT);
