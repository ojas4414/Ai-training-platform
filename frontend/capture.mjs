import puppeteer from 'puppeteer';

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  console.log('Navigating to http://localhost:5174...');
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
  
  // Wait for 3D render
  await new Promise(r => setTimeout(r, 3000));
  
  // Rack 1
  await page.screenshot({ path: 'capture_rack_1.png' });
  
  // Rotate Rack
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(340, 400, { steps: 10 });
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'capture_rack_2.png' });

  // Rotate Rack again
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(640, 200, { steps: 10 });
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'capture_rack_3.png' });
  
  // Pan to Dish (right click drag or shift drag depending on OrbitControls, but OrbitControls uses Right Click to pan)
  await page.mouse.move(640, 400);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(200, 400, { steps: 30 });
  await page.mouse.up({ button: 'right' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'capture_dish_1.png' });

  // Rotate Dish
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(340, 400, { steps: 10 });
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'capture_dish_2.png' });

  // Rotate Dish again
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(640, 600, { steps: 10 });
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'capture_dish_3.png' });

  await browser.close();
  console.log('Done capturing screenshots!');
})();
