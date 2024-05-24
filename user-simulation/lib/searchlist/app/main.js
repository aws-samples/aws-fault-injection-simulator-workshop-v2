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
      args: ['--no-sandbox'],
    });
    const page = await browser.newPage();
    const timeout = 30000;
    page.setDefaultTimeout(timeout);

    {
        const targetPage = page;
        await targetPage.setViewport({
            width: 1516,
            height: 1216
        })
    }
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        startWaitingForEvents();
        // await targetPage.goto('http://URI/');
        const pet_site_url_parameter_name = '/petstore/petsiteurl';
        const petSiteUrl = await getParameterValue(pet_site_url_parameter_name);
        await targetPage.goto(petSiteUrl);
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
                x: 81,
                y: 35,
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
                x: 27.625,
                y: 17,
              },
            });
        await Promise.all(promises);
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('#Varieties_SelectedPetColor'),
            targetPage.locator('::-p-xpath(//*[@id=\\"Varieties_SelectedPetColor\\"])'),
            targetPage.locator(':scope >>> #Varieties_SelectedPetColor'),
            targetPage.locator('::-p-aria(COLOR)'),
            targetPage.locator('::-p-text(all)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 69.8125,
                y: 32,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('#Varieties_SelectedPetColor'),
            targetPage.locator('::-p-xpath(//*[@id=\\"Varieties_SelectedPetColor\\"])'),
            targetPage.locator(':scope >>> #Varieties_SelectedPetColor'),
            targetPage.locator('::-p-aria(COLOR)'),
            targetPage.locator('::-p-text(all)')
        ])
            .setTimeout(timeout)
            .fill('white');
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
                x: 23.625,
                y: 21,
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
                x: 78,
                y: 33,
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
            .fill('puppy');
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
                x: 32.625,
                y: 11,
              },
            });
        await Promise.all(promises);
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('#Varieties_SelectedPetColor'),
            targetPage.locator('::-p-xpath(//*[@id=\\"Varieties_SelectedPetColor\\"])'),
            targetPage.locator(':scope >>> #Varieties_SelectedPetColor'),
            targetPage.locator('::-p-aria(COLOR)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 58.8125,
                y: 25,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('#Varieties_SelectedPetColor'),
            targetPage.locator('::-p-xpath(//*[@id=\\"Varieties_SelectedPetColor\\"])'),
            targetPage.locator(':scope >>> #Varieties_SelectedPetColor'),
            targetPage.locator('::-p-aria(COLOR)')
        ])
            .setTimeout(timeout)
            .fill('all');
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
                x: 16.625,
                y: 21,
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
            targetPage.locator('#seeadoptionlist'),
            targetPage.locator('::-p-xpath(//*[@id=\\"seeadoptionlist\\"])'),
            targetPage.locator(':scope >>> #seeadoptionlist'),
            targetPage.locator('::-p-aria(See Adoption List)'),
            targetPage.locator('::-p-text(See Adoption)')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 100,
                y: 8,
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
                x: 80,
                y: 24,
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
                x: 73,
                y: 22,
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
                x: 25.625,
                y: 16,
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
            targetPage.locator('#seeadoptionlist'),
            targetPage.locator('::-p-xpath(//*[@id=\\"seeadoptionlist\\"])'),
            targetPage.locator(':scope >>> #seeadoptionlist'),
            targetPage.locator('::-p-aria(See Adoption List)'),
            targetPage.locator('::-p-text(See Adoption)')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 63,
                y: 5,
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
                x: 24,
                y: 29,
              },
            });
        await Promise.all(promises);
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('#Varieties_SelectedPetColor'),
            targetPage.locator('::-p-xpath(//*[@id=\\"Varieties_SelectedPetColor\\"])'),
            targetPage.locator(':scope >>> #Varieties_SelectedPetColor'),
            targetPage.locator('::-p-aria(COLOR)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 72.8125,
                y: 19,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('#Varieties_SelectedPetColor'),
            targetPage.locator('::-p-xpath(//*[@id=\\"Varieties_SelectedPetColor\\"])'),
            targetPage.locator(':scope >>> #Varieties_SelectedPetColor'),
            targetPage.locator('::-p-aria(COLOR)')
        ])
            .setTimeout(timeout)
            .fill('white');
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
                x: 43.625,
                y: 5,
              },
            });
        await Promise.all(promises);
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('section.pet-filters > div'),
            targetPage.locator('::-p-xpath(/html/body/div[1]/section[2]/div)'),
            targetPage.locator(':scope >>> section.pet-filters > div')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 11,
                y: 57,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('#Varieties_SelectedPetType'),
            targetPage.locator('::-p-xpath(//*[@id=\\"Varieties_SelectedPetType\\"])'),
            targetPage.locator(':scope >>> #Varieties_SelectedPetType'),
            targetPage.locator('::-p-aria(TYPE)'),
            targetPage.locator('::-p-text(all)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 76,
                y: 44,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('#Varieties_SelectedPetType'),
            targetPage.locator('::-p-xpath(//*[@id=\\"Varieties_SelectedPetType\\"])'),
            targetPage.locator(':scope >>> #Varieties_SelectedPetType'),
            targetPage.locator('::-p-aria(TYPE)'),
            targetPage.locator('::-p-text(all)')
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
                x: 24.625,
                y: 15,
              },
            });
        await Promise.all(promises);
    }

    await browser.close();

};

const restartInterval = 9000; // 5 seconds (adjust as needed)

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
