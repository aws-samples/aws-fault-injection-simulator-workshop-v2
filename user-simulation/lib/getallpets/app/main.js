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
        await targetPage.goto(petSiteUrl, {waitUntil: 'load', timeout: 0}); // Added to remove WS timemout
        await Promise.all(promises);
        console.log(`Navigation successful: ${targetPage.url()}`); // Log successful URL
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('section.pet-hero > div'),
            targetPage.locator('::-p-xpath(/html/body/div[1]/section[1]/div)'),
            targetPage.locator(':scope >>> section.pet-hero > div')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 1091,
                y: 109,
              },
            });
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
                x: 107,
                y: 17,
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
                x: 40,
                y: 13,
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
            targetPage.locator('header img'),
            targetPage.locator('::-p-xpath(/html/body/div[1]/header/div/article/section[1]/a/img)'),
            targetPage.locator(':scope >>> header img'),
            targetPage.locator('::-p-aria(Petadoption[role=\\"image\\"])')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 64,
                y: 17,
              },
            });
        await Promise.all(promises);
        console.log(`Navigation successful: ${targetPage.url()}`); // Log successful URL
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
              delay: 2037.3000000715256,
              offset: {
                x: 1396,
                y: 642,
              },
            });
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
                x: 48.5,
                y: 21.03125,
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
            targetPage.locator('header img'),
            targetPage.locator('::-p-xpath(/html/body/div[1]/header/div/article/section[1]/a/img)'),
            targetPage.locator(':scope >>> header img'),
            targetPage.locator('::-p-aria(Petadoption[role=\\"image\\"])')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 72.5,
                y: 21,
              },
            });
        await Promise.all(promises);
        console.log(`Navigation successful: ${targetPage.url()}`); // Log successful URL
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
                x: 86,
                y: 39,
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
            .fill('bunny');
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
                x: 55.625,
                y: 13,
              },
            });
        await Promise.all(promises);
        console.log(`Navigation successful: ${targetPage.url()}`); // Log successful URL
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
                x: 74.8125,
                y: 37,
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
            .fill('black');
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
                y: 10,
              },
            });
        await Promise.all(promises);
        console.log(`Navigation successful: ${targetPage.url()}`); // Log successful URL
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('#Varieties_SelectedPetColor'),
            targetPage.locator('::-p-xpath(//*[@id=\\"Varieties_SelectedPetColor\\"])'),
            targetPage.locator(':scope >>> #Varieties_SelectedPetColor'),
            targetPage.locator('::-p-aria(COLOR)'),
            targetPage.locator('::-p-text(black)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 89.8125,
                y: 38,
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
            targetPage.locator('::-p-text(black)')
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
                x: 18.625,
                y: 13,
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
            targetPage.locator("div.pet-wrapper > div input[type='submit']"),
            targetPage.locator('::-p-xpath(/html/body/div[1]/div/div/div/form/input[1])'),
            targetPage.locator(":scope >>> div.pet-wrapper > div input[type='submit']"),
            targetPage.locator('::-p-aria(Take me home)'),
            targetPage.locator('::-p-text(Take me home)')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 128.5,
                y: 15.03125,
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
            targetPage.locator('header img'),
            targetPage.locator('::-p-xpath(/html/body/div[1]/header/div/article/section[1]/a/img)'),
            targetPage.locator(':scope >>> header img'),
            targetPage.locator('::-p-aria(Petadoption[role=\\"image\\"])')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 55.5,
                y: 20,
              },
            });
        await Promise.all(promises);
        console.log(`Navigation successful: ${targetPage.url()}`); // Log successful URL
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
                x: 103,
                y: 46,
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
                x: 28.625,
                y: 10,
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
            targetPage.locator("div:nth-of-type(2) input[type='submit']"),
            targetPage.locator('::-p-xpath(/html/body/div[1]/div/div/div[2]/form/input[1])'),
            targetPage.locator(":scope >>> div:nth-of-type(2) input[type='submit']")
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 102.5,
                y: 29.0625,
              },
            });
        await Promise.all(promises);
        console.log(`Navigation successful: ${targetPage.url()}`); // Log successful URL
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('section.col-md-2'),
            targetPage.locator('::-p-xpath(/html/body/div[1]/header/div/article/section[2])'),
            targetPage.locator(':scope >>> section.col-md-2')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 96.5,
                y: 21,
              },
            });
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
                x: 78.5,
                y: 11,
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
            targetPage.locator('header img'),
            targetPage.locator('::-p-xpath(/html/body/div[1]/header/div/article/section[1]/a/img)'),
            targetPage.locator(':scope >>> header img'),
            targetPage.locator('::-p-aria(Petadoption[role=\\"image\\"])')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 78,
                y: 24,
              },
            });
        await Promise.all(promises);
        console.log(`Navigation successful: ${targetPage.url()}`); // Log successful URL
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('div:nth-of-type(14) > form'),
            targetPage.locator('::-p-xpath(/html/body/div[1]/div/div/div[14]/form)'),
            targetPage.locator(':scope >>> div:nth-of-type(14) > form')
        ])
            .setTimeout(timeout)
            .click({
              delay: 1431.5,
              offset: {
                x: 64,
                y: 633.765625,
              },
            });
    }
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        await puppeteer.Locator.race([
            targetPage.locator("div:nth-of-type(14) input[type='submit']"),
            targetPage.locator('::-p-xpath(/html/body/div[1]/div/div/div[14]/form/input[1])'),
            targetPage.locator(":scope >>> div:nth-of-type(14) input[type='submit']")
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 49.5,
                y: 16.390625,
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
            targetPage.locator('header img'),
            targetPage.locator('::-p-xpath(/html/body/div[1]/header/div/article/section[1]/a/img)'),
            targetPage.locator(':scope >>> header img'),
            targetPage.locator('::-p-aria(Petadoption[role=\\"image\\"])')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 63,
                y: 28,
              },
            });
        await Promise.all(promises);
        console.log(`Navigation successful: ${targetPage.url()}`); // Log successful URL
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
                x: 74,
                y: 13,
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
        await puppeteer.Locator.race([
            targetPage.locator('#Varieties_SelectedPetType'),
            targetPage.locator('::-p-xpath(//*[@id=\\"Varieties_SelectedPetType\\"])'),
            targetPage.locator(':scope >>> #Varieties_SelectedPetType'),
            targetPage.locator('::-p-aria(TYPE)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 67,
                y: 23,
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
            .fill('bunny');
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
                x: 6.625,
                y: 13,
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
            targetPage.locator("div:nth-of-type(2) input[type='submit']"),
            targetPage.locator('::-p-xpath(/html/body/div[1]/div/div/div[2]/form/input[1])'),
            targetPage.locator(":scope >>> div:nth-of-type(2) input[type='submit']")
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 131.5,
                y: 25.71875,
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
            targetPage.locator("input[type='submit']"),
            targetPage.locator('::-p-xpath(/html/body/div[1]/div[3]/div/div/form/input[1])'),
            targetPage.locator(":scope >>> input[type='submit']"),
            targetPage.locator('::-p-aria(Pay)')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 206.5,
                y: 5.25,
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
            targetPage.locator('header img'),
            targetPage.locator('::-p-xpath(/html/body/div[1]/header/div/article/section[1]/a/img)'),
            targetPage.locator(':scope >>> header img'),
            targetPage.locator('::-p-aria(Petadoption[role=\\"image\\"])')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 77,
                y: 33,
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
            targetPage.locator("div.pet-wrapper > div > div > div:nth-of-type(1) input[type='submit']"),
            targetPage.locator('::-p-xpath(/html/body/div[1]/div/div/div[1]/form/input[1])'),
            targetPage.locator(":scope >>> div.pet-wrapper > div > div > div:nth-of-type(1) input[type='submit']")
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 114.5,
                y: 26.5,
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
            targetPage.locator("input[type='submit']"),
            targetPage.locator('::-p-xpath(/html/body/div[1]/div[3]/div/div/form/input[1])'),
            targetPage.locator(":scope >>> input[type='submit']"),
            targetPage.locator('::-p-aria(Pay)')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 91.5,
                y: 29.21875,
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
            targetPage.locator('header img'),
            targetPage.locator('::-p-xpath(/html/body/div[1]/header/div/article/section[1]/a/img)'),
            targetPage.locator(':scope >>> header img'),
            targetPage.locator('::-p-aria(Petadoption[role=\\"image\\"])')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 61,
                y: 13,
              },
            });
        await Promise.all(promises);
        console.log(`Navigation successful: ${targetPage.url()}`); // Log successful URL
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
                y: 20,
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
            .click({
              offset: {
                x: 44,
                y: 32,
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
                x: 34.625,
                y: 8,
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
            targetPage.locator("div:nth-of-type(2) input[type='submit']"),
            targetPage.locator('::-p-xpath(/html/body/div[1]/div/div/div[2]/form/input[1])'),
            targetPage.locator(":scope >>> div:nth-of-type(2) input[type='submit']")
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 125.5,
                y: 30.0625,
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
            targetPage.locator("input[type='submit']"),
            targetPage.locator('::-p-xpath(/html/body/div[1]/div[3]/div/div/form/input[1])'),
            targetPage.locator(":scope >>> input[type='submit']"),
            targetPage.locator('::-p-aria(Pay)')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 277.5,
                y: 38.15625,
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
                x: 102,
                y: 10,
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
            targetPage.locator('header img'),
            targetPage.locator('::-p-xpath(/html/body/div[1]/header/div/article/section[1]/a/img)'),
            targetPage.locator(':scope >>> header img'),
            targetPage.locator('::-p-aria(Petadoption[role=\\"image\\"])')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 32,
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
            targetPage.locator("div:nth-of-type(3) input[type='submit']"),
            targetPage.locator('::-p-xpath(/html/body/div[1]/div/div/div[3]/form/input[1])'),
            targetPage.locator(":scope >>> div:nth-of-type(3) input[type='submit']")
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 93.5,
                y: 31.03125,
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
            targetPage.locator("input[type='submit']"),
            targetPage.locator('::-p-xpath(/html/body/div[1]/div[3]/div/div/form/input[1])'),
            targetPage.locator(":scope >>> input[type='submit']"),
            targetPage.locator('::-p-aria(Pay)')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 280.5,
                y: 31.4375,
              },
            });
        await Promise.all(promises);
        console.log(`Navigation successful: ${targetPage.url()}`); // Log successful URL
    }

    await browser.close();

};

const restartInterval = 10000; // 5 seconds (adjust as needed)


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
