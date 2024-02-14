var synthetics = require('Synthetics');
const log = require('SyntheticsLogger');
const syntheticsConfiguration = synthetics.getConfiguration();
const syntheticsLogHelper = require('SyntheticsLogHelper');
const puppeteer = require('puppeteer-core');


const pageLoadBlueprint = async function () {

    // Set user-agent
    const iPhone = puppeteer.devices['iPhone 12'];
    const windows = puppeteer.devices['Windows 10'];

    const chromeUserAgent = "HTC Mozilla/5.0 (Linux; Android 7.0; HTC 10 Build/NRD90M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.83 Mobile Safari/537.36";
    const firefoxUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0";
    const userAgent = Math.random() > 0.5 ? chromeUserAgent : firefoxUserAgent;

    const device = Math.random() > 0.5 ? iPhone : windows;
    log.error(userAgent);

    // Set screenshot option
    const takeScreenshot = true;

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

    // INSERT URL here
    const URL = process.env.URL;

    let page = await synthetics.getPage();
    await page.setUserAgent(userAgent);
  
    await synthetics.addUserAgent(page, userAgent);

    await loadUrl(page, URL, takeScreenshot);
    await page.waitForTimeout(1000);

    await synthetics.takeScreenshot('loaded', 'loaded');
};

const loadUrl = async function (page, url, takeScreenshot) {
    let stepName = null;
    let domcontentloaded = false;

    try {
        stepName = new URL(url).hostname;
    } catch (e) {
        const errorString = `Error parsing url: ${url}. ${e}`;
        log.error(errorString);
        /* If we fail to parse the URL, don't emit a metric with a stepName based on it.
           It may not be a legal CloudWatch metric dimension name and we may not have an alarms
           setup on the malformed URL stepName.  Instead, fail this step which will
           show up in the logs and will fail the overall canary and alarm on the overall canary
           success rate.
        */
        throw e;
    }

    await synthetics.executeStep(stepName, async function () {
        const sanitizedUrl = syntheticsLogHelper.getSanitizedUrl(url);

        /* You can customize the wait condition here. For instance, using 'networkidle2' or 'networkidle0' to load page completely.
           networkidle0: Navigation is successful when the page has had no network requests for half a second. This might never happen if page is constantly loading multiple resources.
           networkidle2: Navigation is successful when the page has no more then 2 network requests for half a second.
           domcontentloaded: It's fired as soon as the page DOM has been loaded, without waiting for resources to finish loading. If needed add explicit wait with await new Promise(r => setTimeout(r, milliseconds))
        */
        const response = await page.goto(url, { waitUntil: ['domcontentloaded'], timeout: 30000});
        if (response) {
            domcontentloaded = true;
            const status = response.status();
            const statusText = response.statusText();

            logResponseString = `Response from url: ${sanitizedUrl}  Status: ${status}  Status Text: ${statusText}`;

            //If the response status code is not a 2xx success code
            if (response.status() < 200 || response.status() > 299) {
                throw new Error(`Failed to load url: ${sanitizedUrl} ${response.status()} ${response.statusText()}`);
            }
        } else {
            const logNoResponseString = `No response returned for url: ${sanitizedUrl}`;
            log.error(logNoResponseString);
            throw new Error(logNoResponseString);
        }
    });

    // Wait for 15 seconds to let page load fully before taking screenshot.
    if (domcontentloaded && takeScreenshot) {
        await new Promise(r => setTimeout(r, 15000));
        await synthetics.takeScreenshot(stepName, 'loaded');
    }
};

exports.handler = async () => {
    return await pageLoadBlueprint();
};