const synthetics = require('Synthetics');
const log = require('SyntheticsLogger');
const syntheticsConfiguration = synthetics.getConfiguration();


const apiCanaryBlueprint = async function () {
    const chromeUserAgent = "HTC Mozilla/5.0 (Linux; Android 7.0; HTC 10 Build/NRD90M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.83 Mobile Safari/537.36";
    const firefoxUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0";
    const userAgent = Math.random() > 0.5 ? chromeUserAgent : firefoxUserAgent;

    let page = await synthetics.getPage();
    await page.setUserAgent(userAgent);
    const URL = process.env.URL;
    const hostname = URL.replace("http://", "");

    syntheticsConfiguration.setConfig({
        restrictedHeaders: [], // Value of these headers will be redacted from logs and reports
        restrictedUrlParameters: [] // Values of these url parameters will be redacted from logs and reports
    });

    // Handle validation for positive scenario
    const validateSuccessful = async function(res) {
        return new Promise((resolve, reject) => {
            if (res.statusCode < 200 || res.statusCode > 299) {
                throw new Error(res.statusCode + ' ' + res.statusMessage);
            }

            let responseBody = '';
            res.on('data', (d) => {
                responseBody += d;
            });

            res.on('end', () => {
                // Add validation on 'responseBody' here if required.
                resolve();
            });
        });
    };

    // Set request option for Check API
    const rnd = Math.floor(Math.random() * 1000)
    //const rndBody = rnd.toString()
    let requestOptionsStep1 = {
        hostname: hostname,
        method: 'GET',
        path: '/?rnd=' + rnd,
        port: '80',
        protocol: 'http:',
        headers: {"Cache-Control":"no-cache, no-store, must-revalidate","Pragma":"no-cache","Expires":"0"}
    };
    //requestOptionsStep1['headers']['User-Agent'] = [synthetics.getCanaryUserAgentString(), requestOptionsStep1['headers']['User-Agent']].join(' ');
    requestOptionsStep1['headers']['User-Agent'] = userAgent+'/'+rnd;

    // Set step config option for Check API
    let stepConfig1 = {
        includeRequestHeaders: true,
        includeResponseHeaders: true,
        includeRequestBody: true,
        includeResponseBody: true,
        continueOnHttpStepFailure: true
    };

    await synthetics.executeHttpStep('Check API', requestOptionsStep1, validateSuccessful, stepConfig1);

};

exports.handler = async () => {
    return await apiCanaryBlueprint();
};
