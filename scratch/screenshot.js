const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://maps.app.goo.gl/nZMHor2QAbYdBg9D7', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 5000));
  await page.screenshot({ path: 'maps.png' });
  const html = await page.content();
  const fs = require('fs');
  fs.writeFileSync('maps.html', html);
  await browser.close();
})();
