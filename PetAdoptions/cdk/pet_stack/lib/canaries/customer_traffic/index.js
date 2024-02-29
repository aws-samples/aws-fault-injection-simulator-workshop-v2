const { URL } = require('url');
const synthetics = require('Synthetics');
const log = require('SyntheticsLogger');
const syntheticsConfiguration = synthetics.getConfiguration();
const syntheticsLogHelper = require('SyntheticsLogHelper');

const loadBlueprint = async function () {
    const chromeUserAgent = "HTC Mozilla/5.0 (Linux; Android 7.0; HTC 10 Build/NRD90M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.83 Mobile Safari/537.36";
    const firefoxUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0";
    const userAgent = Math.random() > 0.5 ? chromeUserAgent : firefoxUserAgent;
    log.error(userAgent);


    const url = process.env.URL;

    /* Disabling default step screen shots taken during Synthetics.executeStep() calls
     * Step will be used to publish metrics on time taken to load dom content but
     * Screenshots will be taken outside the executeStep to allow for page to completely load with domcontentloaded
     * You can change it to load, networkidle0, networkidle2 depending on what works best for you.
     */
    syntheticsConfiguration.disableStepScreenshots();
    syntheticsConfiguration.setConfig({
       continueOnStepFailure: true,
       includeRequestHeaders: true, // Enable if headers should be displayed in HAR
       includeResponseHeaders: true, // Enable if headers should be displayed in HAR
       restrictedHeaders: [], // Value of these headers will be redacted from logs and reports
       restrictedUrlParameters: [] // Values of these url parameters will be redacted from logs and reports

    });

    let page = await synthetics.getPage();
    await page.setUserAgent(userAgent);
  
    await synthetics.addUserAgent(page, userAgent);

    await loadUrl(page, url);

};

const loadUrl = async function (page, url,) {
    let domcontentloaded = false;

    const navigationPromise = page.waitForNavigation()

    // HomePage
    let response = null;
    let sanitizedUrl = null;
    await synthetics.executeStep('HomePage', async function () {
        sanitizedUrl = syntheticsLogHelper.getSanitizedUrl(url);

        response = await page.goto(url, { waitUntil: ['domcontentloaded', 'networkidle0', 'networkidle2'], timeout: 30000});
        await navigationPromise;
    });

    if (response) {
        domcontentloaded = true;
        const status = response.status();
        const statusText = response.statusText();

        // Wait for 5 seconds to let page load fully before taking screenshot.
        await new Promise(r => setTimeout(r, 5000));
        await synthetics.takeScreenshot('HomePage', 'loaded');

        //If the response status code is not a 2xx success code
        if (response.status() < 200 || response.status() > 299) {
            throw new Error(`Failed to load url: ${sanitizedUrl} ${response.status()} ${response.statusText()}`);
        }
    } else {
        const logNoResponseString = `No response returned for url: ${sanitizedUrl}`;
        log.error(logNoResponseString);
        throw new Error(logNoResponseString);
    }

    if(domcontentloaded) {
        // Test click animal
        stepName = 'Click for a pet';
        petadopted = false;

        // Check if a pet is clickable
        try {
            while (petadopted == false) {
                petclick = Math.floor(Math.random() * 20) + 1
                await synthetics.executeStep(stepName, async function () {
                    responseclick = await page.waitForSelector('.container > .pet-items > .pet-item:nth-child(' + petclick + ') > form > .pet-button')
                    if (responseclick) {
                        await page.click('.container > .pet-items > .pet-item:nth-child(' + petclick + ') > form > .pet-button')
                        petadopted = true;
                        await navigationPromise;
                    }
                })
            }
        } catch (error) {
            log.info("error click pet");
        }
        if(petadopted == true) {
            
            // Wait for 5 seconds to let page load fully before taking screenshot.
            await new Promise(r => setTimeout(r, 5000));
            await synthetics.takeScreenshot(stepName, 'loaded');

            // Test Click Confirmation
            stepName = 'Click Confirmation'
            await synthetics.executeStep(stepName, async function() {
                await page.waitForSelector('.container > .row > .col-xs-12 > form > .btn')
                await page.click('.container > .row > .col-xs-12 > form > .btn')
                await navigationPromise;
            })

            // Wait for 5 seconds to let page load fully before taking screenshot.
            await new Promise(r => setTimeout(r, 5000));
            await synthetics.takeScreenshot(stepName, 'loaded');

            // Test Click PetListAdoptions
            stepName = 'Click PetListAdoptions'
            await synthetics.executeStep('Click PetListAdoptions', async function() {
                await page.waitForSelector('article a[href*="/PetListAdoptions"]')
                await page.click('article a[href*="/PetListAdoptions"]')
                await navigationPromise;
            })
            
            // Wait for 5 seconds to let page load fully before taking screenshot.
            await new Promise(r => setTimeout(r, 5000));
            await synthetics.takeScreenshot(stepName, 'loaded');

            // Test Click Home
            stepName = 'Click HomePage'
            await synthetics.executeStep('Click HomePage', async function() {
                await page.waitForSelector('article a[href*="/"]')
                await page.click('article a[href*="/"]')
                await navigationPromise;
            })

            // Wait for 5 seconds to let page load fully before taking screenshot.
            await new Promise(r => setTimeout(r, 5000));
            await synthetics.takeScreenshot(stepName, 'loaded');

            // Test performhousekeeping
            stepName = 'Click HouseKeeping'
            await synthetics.executeStep(stepName, async function() {
                await page.waitForSelector('article a[href*="/housekeeping"]')
                await page.click('article a[href*="/housekeeping"]')
                await navigationPromise;
            })
            
            // Wait for 5 seconds to let page load fully before taking screenshot.
            await new Promise(r => setTimeout(r, 5000));
            await synthetics.takeScreenshot(stepName, 'loaded');
        }
    }
};

exports.handler = async () => {
    return await loadBlueprint();
};