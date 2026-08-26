const puppeteer = require('puppeteer');

(async () => {
  try {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    console.log("Browser launched. Opening page...");
    const page = await browser.newPage();
    
    // Set viewport and user agent to simulate a real browser
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    
    console.log("Navigating to URL...");
    await page.goto('https://maps.app.goo.gl/nZMHor2QAbYdBg9D7', { waitUntil: 'networkidle2' });
    
    console.log("Waiting for list to load...");
    // Wait for some common elements that represent places in Google Maps
    await new Promise(r => setTimeout(r, 5000)); // Give it some time to load the initial list
    
    // Scroll the list to load all items
    console.log("Scrolling to load all items...");
    await page.evaluate(async () => {
        // Find the scrollable container. Usually it's a div with role="main" or specific classes
        const scrollableDiv = document.querySelector('div[role="main"]') || document.querySelector('.m6QErb.DxyBCb.kA9KIf.dS8cW');
        if (scrollableDiv) {
            for (let i = 0; i < 20; i++) {
                scrollableDiv.scrollBy(0, 1000);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } else {
            // fallback scroll window
            for (let i = 0; i < 20; i++) {
                window.scrollBy(0, 1000);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("Extracting restaurant data...");
    const restaurants = await page.evaluate(() => {
        const results = [];
        // Google Maps places often have this class or a link with an aria-label
        const placeElements = document.querySelectorAll('a.hfpxzc, div.Nv2PK');
        
        placeElements.forEach(el => {
            let name = el.getAttribute('aria-label') || el.innerText || '';
            // if we are using the 'a' tag, its aria-label usually contains the name
            if (name) {
                results.push({ name: name.trim() });
            }
        });
        
        // Remove duplicates if any
        const unique = Array.from(new Set(results.map(a => a.name)))
            .map(name => {
                return results.find(a => a.name === name)
            });
            
        return unique;
    });

    console.log(JSON.stringify(restaurants, null, 2));
    console.log(`Extracted ${restaurants.length} restaurants.`);
    
    await browser.close();
  } catch (err) {
    console.error("Error scraping:", err);
    process.exit(1);
  }
})();
