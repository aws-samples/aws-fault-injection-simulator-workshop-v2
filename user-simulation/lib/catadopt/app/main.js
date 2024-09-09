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
    });
    const page = await browser.newPage();
    const timeout = 60000;
    page.setDefaultTimeout(timeout);

    {
        const targetPage = page;
        await targetPage.setViewport({
            width: 1301,
            height: 968
        })
    }
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        startWaitingForEvents();
        //await targetPage.goto('http://URI/');
        const pet_site_url_parameter_name = '/petstore/petsiteurl';
        const petSiteUrl = await getParameterValue(pet_site_url_parameter_name);
        await targetPage.goto(petSiteUrl);
        await Promise.all(promises);
    }
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        await puppeteer.Locator.race([
            targetPage.locator('#performhousekeeping'),
            targetPage.locator('::-p-xpath(//*[@id=\\"performhousekeeping\\"])'),
            targetPage.locator(':scope >>> #performhousekeeping'),
            targetPage.locator('::-p-aria(Perform Housekeeping)'),
            targetPage.locator('::-p-text(Perform Housekeeping)')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 79.5,
                y: 12,
              },
            });
        await Promise.all(promises);
    }
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        await puppeteer.Locator.race([
            targetPage.locator('header img'),
            targetPage.locator('::-p-xpath(/html/body/div[1]/header/div/article/section[1]/a/img)'),
            targetPage.locator(':scope >>> header img'),
            targetPage.locator('::-p-aria(Petadoption[role=\\"image\\"])')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 71.5,
                y: 31,
              },
            });
        await Promise.all(promises);
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('#Varieties_SelectedPetType'),
            targetPage.locator('::-p-xpath(//*[@id=\\"Varieties_SelectedPetType\\"])'),
            targetPage.locator(':scope >>> #Varieties_SelectedPetType'),
            targetPage.locator('::-p-aria(TYPE)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 67.5,
                y: 34,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('#Varieties_SelectedPetType'),
            targetPage.locator('::-p-xpath(//*[@id=\\"Varieties_SelectedPetType\\"])'),
            targetPage.locator(':scope >>> #Varieties_SelectedPetType'),
            targetPage.locator('::-p-aria(TYPE)')
        ])
            .setTimeout(timeout)
            .fill('kitten');
    }
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        await puppeteer.Locator.race([
            targetPage.locator('#searchpets'),
            targetPage.locator('::-p-xpath(//*[@id=\\"searchpets\\"])'),
            targetPage.locator(':scope >>> #searchpets'),
            targetPage.locator('::-p-aria(Search)'),
            targetPage.locator('::-p-text(Search)')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 44.125,
                y: 13,
              },
            });
        await Promise.all(promises);
    }
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        await puppeteer.Locator.race([
            targetPage.locator("div:nth-of-type(3) input[type='submit']"),
            targetPage.locator('::-p-xpath(/html/body/div[1]/div/div/div[3]/form/input[1])'),
            targetPage.locator(":scope >>> div:nth-of-type(3) input[type='submit']")
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 109,
                y: 19.765625,
              },
            });
        await Promise.all(promises);
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('div.pet-wrapper'),
            targetPage.locator('::-p-xpath(/html/body/div[1])'),
            targetPage.locator(':scope >>> div.pet-wrapper')
        ])
            .setTimeout(timeout)
            .click({
              delay: 622.1000000238419,
              offset: {
                x: 63,
                y: 866,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('#cardNumber'),
            targetPage.locator('::-p-xpath(//*[@id=\\"cardNumber\\"])'),
            targetPage.locator(':scope >>> #cardNumber'),
            targetPage.locator('::-p-aria(CARD NUMBER)'),
            targetPage.locator('::-p-text(0001 1000 0001)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 48.5,
                y: 19.515625,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('#cardNumber'),
            targetPage.locator('::-p-xpath(//*[@id=\\"cardNumber\\"])'),
            targetPage.locator(':scope >>> #cardNumber'),
            targetPage.locator('::-p-aria(CARD NUMBER)'),
            targetPage.locator('::-p-text(0001 1000 0001)')
        ])
            .setTimeout(timeout)
            .click({
              count: 2,
              offset: {
                x: 37.5,
                y: 17.515625,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('#cardNumber'),
            targetPage.locator('::-p-xpath(//*[@id=\\"cardNumber\\"])'),
            targetPage.locator(':scope >>> #cardNumber'),
            targetPage.locator('::-p-aria(CARD NUMBER)'),
            targetPage.locator('::-p-text(0001 1000 0001)')
        ])
            .setTimeout(timeout)
            .fill('1111 1000 0001 1000');
    }
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        await puppeteer.Locator.race([
            targetPage.locator("input[type='submit']"),
            targetPage.locator('::-p-xpath(/html/body/div[1]/div[3]/div/div/form/input[1])'),
            targetPage.locator(":scope >>> input[type='submit']"),
            targetPage.locator('::-p-aria(Pay)')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 148.5,
                y: 20.328125,
              },
            });
        await Promise.all(promises);
    }
    {
        const timeout = 5000;
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        await puppeteer.Locator.race([
            targetPage.locator('#seeadoptionlist'),
            targetPage.locator('::-p-xpath(//*[@id=\\"seeadoptionlist\\"])'),
            targetPage.locator(':scope >>> #seeadoptionlist'),
            targetPage.locator('::-p-aria(See Adoption List)'),
            targetPage.locator('::-p-text(See Adoption)')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              delay: 1784,
              offset: {
                x: 81.5,
                y: 11,
              },
            });
        await Promise.all(promises);
    }

    await browser.close();
};

const restartInterval = 15000; // 5 seconds (adjust as needed)

const runForever = async () => {
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
