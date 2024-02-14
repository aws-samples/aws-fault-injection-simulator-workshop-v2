var synthetics = require('Synthetics');
const log = require('SyntheticsLogger');

const recordedScript = async function () {
  const chromeUserAgent = "HTC Mozilla/5.0 (Linux; Android 7.0; HTC 10 Build/NRD90M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.83 Mobile Safari/537.36";
  const firefoxUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0";
  const userAgent = Math.random() > 0.5 ? chromeUserAgent : firefoxUserAgent;

  let page = await synthetics.getPage();
  await page.setUserAgent(userAgent);

  const URL = process.env.URL;

  await synthetics.executeStep('Go to Petsite landing page', async function () {
    const navigationPromise = page.waitForNavigation();
    await page.goto(URL)
    await navigationPromise
    await page.waitForSelector('.pet-wrapper #searchpets')
  })
  await page.waitForTimeout(2000);

  let petTypes = await page.evaluate(function () {
    return Array.from($('select[name="selectedPetType"] option')).map(e => e.value)
  });
  let petColor = await page.evaluate(function () {
    return Array.from($('select[name="selectedPetColor"] option')).map(e => e.value)
  });

  // Search 10 random combinations
  for (let i = 0; i < 10; i++) {
    let rndPt = petTypes[Math.floor(Math.random() * petTypes.length)];
    let rndPc = petColor[Math.floor(Math.random() * petColor.length)];
    if (i < 3) rndPt = "bunny"; // Search random bunny combinations for the first 3 iterations

    await synthetics.executeStep('Searching ' + rndPt + ' ' + rndPc, async function () {
      await page.waitForSelector('.pet-filters #Varieties_SelectedPetType')
      await page.click('.pet-filters #Varieties_SelectedPetType')
      await page.select('.pet-filters #Varieties_SelectedPetType', rndPt)
      await page.waitForSelector('.pet-filters #Varieties_SelectedPetColor')
      await page.click('.pet-filters #Varieties_SelectedPetColor')
      await page.select('.pet-filters #Varieties_SelectedPetColor', rndPc)
      await page.waitForSelector('.pet-wrapper #searchpets')
      await Promise.all([page.click('.pet-wrapper #searchpets'), page.waitForNavigation()]);
    })

    await page.waitForTimeout(3000);
  }

};
exports.handler = async () => {
  return await recordedScript();
};