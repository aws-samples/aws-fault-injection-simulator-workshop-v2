const puppeteer = require('puppeteer'); // v22.0.0 or later
const { run } = require('node:test');
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

async function getParameterValue(parameterName) {
    try {
      const ssmClient = new SSMClient({ region: process.env.AWS_REGION });
      const response = await ssmClient.send(
        new GetParameterCommand({
          Name: parameterName,
          WithDecryption: true,
        })
      );
      return response.Parameter.Value;
    } catch (error) {
      console.error(`Error getting parameter value: ${error}`);
      throw error;
    }
  }

let petSiteUrl;

const main = async () => {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
       '--no-sandbox',
       '--disable-setuid-sandbox',
       '--disable-dev-shm-usage',
       '--disable-accelerated-2d-canvas',
       '--no-first-run',
       '--no-zygote',
       '--disable-gpu'
      ],
       timeout: 60000,
       protocolTimeout: 20000, 
      }).catch((err)=> {
      console.error('Failed to launch browser:', err);
      process.exit(1);
      });
    const page = await browser.newPage();
    const timeout = 60000;
    page.setDefaultTimeout(timeout);

    {
        const targetPage = page;
        await targetPage.setViewport({
            width: 1280,
            height: 976
        })
    }
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        startWaitingForEvents();
        await targetPage.goto(petSiteUrl, {waitUntil: 'load', timeout: 0}); // Added to remove WS timemout
        await Promise.all(promises);
        console.log(`Navigation successful: ${targetPage.url()}`); // Log successful URL
    }
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Perform Housekeeping)'),
            targetPage.locator('#performhousekeeping'),
            targetPage.locator('::-p-xpath(//*[@id=\\"performhousekeeping\\"])'),
            targetPage.locator(':scope >>> #performhousekeeping'),
            targetPage.locator('::-p-text(Perform Housekeeping)')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 61,
                y: 7,
              },
            });
        await Promise.all(promises);
        console.log(`Navigation successful: ${targetPage.url()}`); // Log successful URL
    }
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Petadoption[role=\\"image\\"])'),
            targetPage.locator('header img'),
            targetPage.locator('::-p-xpath(/html/body/div/header/div/article/section[1]/a/img)'),
            targetPage.locator(':scope >>> header img')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 61,
                y: 26,
              },
            });
        await Promise.all(promises);
        console.log(`Navigation successful: ${targetPage.url()}`); // Log successful URL
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(TYPE)'),
            targetPage.locator('#Varieties_SelectedPetType'),
            targetPage.locator('::-p-xpath(//*[@id=\\"Varieties_SelectedPetType\\"])'),
            targetPage.locator(':scope >>> #Varieties_SelectedPetType')
        ])
            .setTimeout(timeout)
            .fill('puppy');
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(COLOR)'),
            targetPage.locator('#Varieties_SelectedPetColor'),
            targetPage.locator('::-p-xpath(//*[@id=\\"Varieties_SelectedPetColor\\"])'),
            targetPage.locator(':scope >>> #Varieties_SelectedPetColor'),
            targetPage.locator('::-p-text(all)')
        ])
            .setTimeout(timeout)
            .fill('brown');
    }
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Search)'),
            targetPage.locator('#searchpets'),
            targetPage.locator('::-p-xpath(//*[@id=\\"searchpets\\"])'),
            targetPage.locator(':scope >>> #searchpets'),
            targetPage.locator('::-p-text(Search)')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 29.09375,
                y: 14,
              },
            });
        await Promise.all(promises);
        console.log(`Navigation successful: ${targetPage.url()}`); // Log successful URL
    }
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        await puppeteer.Locator.race([
            targetPage.locator("div:nth-of-type(4) input[type='submit']"),
            targetPage.locator('::-p-xpath(/html/body/div/div/div/div[4]/form/input[1])'),
            targetPage.locator(":scope >>> div:nth-of-type(4) input[type='submit']")
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              delay: 496,
              offset: {
                x: 90.5,
                y: 21.171875,
              },
            });
        await Promise.all(promises);
        console.log(`Navigation successful: ${targetPage.url()}`); // Log successful URL
    }
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Pay)'),
            targetPage.locator("input[type='submit']"),
            targetPage.locator('::-p-xpath(/html/body/div/div[3]/div/div/form/input[1])'),
            targetPage.locator(":scope >>> input[type='submit']")
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 166,
                y: 19.421875,
              },
            });
        await Promise.all(promises);
        console.log(`Navigation successful: ${targetPage.url()}`); // Log successful URL
    }
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(See Adoption List)'),
            targetPage.locator('#seeadoptionlist'),
            targetPage.locator('::-p-xpath(//*[@id=\\"seeadoptionlist\\"])'),
            targetPage.locator(':scope >>> #seeadoptionlist'),
            targetPage.locator('::-p-text(See Adoption)')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 77,
                y: 12,
              },
            });
        await Promise.all(promises);
        console.log(`Navigation successful: ${targetPage.url()}`); // Log successful URL
    }
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Petadoption[role=\\"image\\"])'),
            targetPage.locator('header img'),
            targetPage.locator('::-p-xpath(/html/body/div/header/div/article/section[1]/a/img)'),
            targetPage.locator(':scope >>> header img')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              delay: 624,
              offset: {
                x: 49,
                y: 25,
              },
            });
        await Promise.all(promises);
        console.log(`Navigation successful: ${targetPage.url()}`); // Log successful URL
    }

    await browser.close();

};

const restartInterval = 11000; // 11 seconds (adjust as needed)

const runForever = async () => {
  // Fetch the URL once before entering the loop
  if (!petSiteUrl) {
    const pet_site_url_parameter_name = '/petstore/petsiteurl';
    petSiteUrl = await getParameterValue(pet_site_url_parameter_name);
  }
         
  while (true) {
    try {
      await main();
      console.log(`Restarting in ${restartInterval / 1000} seconds...`);
    } catch (error) {
      console.error(error);
      console.log(`Restarting in ${restartInterval / 1000} seconds...`);
    }
    await new Promise((resolve) => setTimeout(resolve, restartInterval));
  }

};

runForever();
