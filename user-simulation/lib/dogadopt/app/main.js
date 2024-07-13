const { run } = require('node:test');
const puppeteer = require('puppeteer'); // v20.7.4 or later
const AWS = require('aws-sdk');

// Configure the AWS SDK
AWS.config.update({
   region: process.env.AWS_REGION,
});

const ssm = new AWS.SSM();

async function getParameterValue(parameterName) {
    try {
      const response = await ssm.getParameter({
        Name: parameterName,
        WithDecryption: true,
      }).promise();
      return response.Parameter.Value;
    } catch (error) {
      console.error(`Error getting parameter value: ${error}`);
      throw error;
    }
  }

const main = async () => {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
    });
    const page = await browser.newPage();
    const timeout = 30000;
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
    }

    await browser.close();

};

const restartInterval = 5000; // 5 seconds (adjust as needed)

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
