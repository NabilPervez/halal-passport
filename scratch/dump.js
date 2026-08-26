const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://maps.app.goo.gl/nZMHor2QAbYdBg9D7', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 8000));
  
  // Dump all inner text
  const text = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync('maps_text.txt', text);
  
  await browser.close();
})();
