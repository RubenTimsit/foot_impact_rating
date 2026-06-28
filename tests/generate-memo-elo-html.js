'use strict';
/**
 * generate-memo-elo-html.js
 * Convertit memo-elo-template.html en PDF via Puppeteer + KaTeX.
 *
 * Usage : cd tests && node generate-memo-elo-html.js
 */

const puppeteer = require('puppeteer');
const path      = require('path');

const INPUT  = path.join(__dirname, 'memo-elo-template.html');
const OUTPUT = path.join(__dirname, '..', 'memo-systeme-elo.pdf');

(async () => {
  console.log('Lancement du navigateur...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  console.log('Chargement du template HTML...');
  await page.goto(`file:///${INPUT.replace(/\\/g,'/')}`, {
    waitUntil: 'networkidle0',
    timeout: 30000,
  });

  // Attendre que KaTeX ait fini de rendre toutes les formules
  await page.waitForFunction(() => {
    const els = document.querySelectorAll('.formula-box, .box-blue, .box-green, .box-red, .box-orange');
    return els.length > 0;
  });
  // Petite pause supplementaire pour s'assurer que KaTeX est bien rendu
  await new Promise(r => setTimeout(r, 2000));

  console.log('Generation du PDF...');
  await page.pdf({
    path: OUTPUT,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    displayHeaderFooter: false,
  });

  await browser.close();
  console.log('PDF genere : ' + OUTPUT);
})().catch(err => {
  console.error('Erreur :', err.message);
  process.exit(1);
});
