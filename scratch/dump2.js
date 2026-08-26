const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://maps.app.goo.gl/nZMHor2QAbYdBg9D7', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 5000));
  
  console.log("Scrolling...");
  for(let i=0; i<100; i++) {
     await page.evaluate(() => {
         // Scroll any div that has overflow-y auto/scroll or just scrollable
         const elements = document.querySelectorAll('div');
         for (const el of elements) {
             if (el.scrollHeight > el.clientHeight && el.clientHeight > 100) {
                 el.scrollBy(0, 2000);
             }
         }
     });
     await new Promise(r => setTimeout(r, 800));
     if(i % 10 === 0) console.log("Scrolled " + i + " times");
  }

  const text = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync('maps_text_full.txt', text);
  console.log("Done dumping text");
  
  await browser.close();
})();
