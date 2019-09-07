const request = require('request');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
})
const htmlToText = require('html-to-text');


const supportedLanguages = ['en', 'fr', 'ceb', 'sv', 'de', 'nl'];

const lang = process.argv[2];
if (!supportedLanguages.includes(lang)) {
  console.log(`Oops! ${lang} language is not supported. See supported languages => `, supportedLanguages)
  process.exit(-1);
}

function doGetRequest(url) {
  return new Promise((resolve, reject) => {
    request.get(url, (err, response, body) => {
      if (err) {
        reject(err)
        return
      }
      resolve(JSON.parse(body))
    })

  })
}

async function randomArticle() {
  return doGetRequest('https://en.wikipedia.org/w/api.php?action=query&list=random&format=json&rnnamespace=0&rnlimit=1');
}
async function getArticleMeta(lang, name) {
  const article = encodeURIComponent(name);
  const query = `?action=query&list=search&srsearch=${article}&srlimit=1&format=json&prop=info|revisions`;
  const url = `https://${lang}.wikipedia.org/w/api.php${query}`;
  return doGetRequest(url);
}

async function getArticleContent(lang, pageID) {
  const query = `?action=query&pageids=${pageID}&format=json&prop=revisions|info|extracts`;
  const url = `https://${lang}.wikipedia.org/w/api.php${query}`;
  return await doGetRequest(url);
}

const CMD_QUIT = 'QUIT';
const CMD_HELP = 'HELP';
const CMD_READ = 'READ';
const CMD_ABOUT = 'ABOUT';
const CMD_RANDOM = 'RANDOM';

function help() {
  let help = '-------------------------- Welcome to Wikipedia CLI Reader -------------------------------';
  help += '\nAvailable Commands:';
  help += `\n\t${CMD_ABOUT} <article> - Show meta data about an Article specified by <article>`;
  help += `\n\t${CMD_READ} <article>  - Read an Article specified by <article>`;
  help += `\n\t${CMD_RANDOM}          - Read any random Article`;
  help += `\n\t${CMD_HELP}            - Shows info about all the available commands`;
  help += `\n\t${CMD_QUIT}            - Exits the application`;
  help += '\n\nEnter Command: ';
  return help;
}

function quit() {
  console.log('Good Bye!');
  process.exit(0);
}

async function getAbout(ln, name) {
  let about = '';
  try {
    const meta = await getArticleMeta(ln, name);
    const search = meta.query.search[0];
    const pageID = search.pageid;
    const article = await getArticleContent(ln, pageID);
    const page = article.query.pages[pageID];
    const revision = page.revisions[0];
    about += `Title:                  ${search.title}\n`
    // about += `Creation Date:          ${}\n`;
    // about += `First Version Author:   ${revision.urser}\n`;
    about += `Last Modified Date:     ${new Date(revision.timestamp).toLocaleString()}\n`;
    about += `Last Version Author:    ${revision.user}\n`;
    about += `Size in Bytes:          ${search.size}`;
  } catch(err) {
    about = 'Oops, an error occured. Please try again later.';
  }
  return about;
}

function readPerParagraph(allParagraphs) {
  return new Promise((resolve) => {
    const rl = require('readline')
    let index = 0;
    rl.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    cb = function(str) {
      switch(str.toUpperCase()) {
        case 'N': {
          while(index < allParagraphs.length) {
            const p = allParagraphs[index];
            if (allParagraphs[index]) {
              console.log('\r', p)
              console.log('');
              if (index === allParagraphs.length-1) {
                process.stdin.setRawMode(false);
                resolve();
              }
              break;
            }
            index++;
          }
          index++;
          break;
        }
        case 'E': {
          process.stdin.setRawMode(false);
          resolve()
        }
      }
    }
    process.stdin.on('keypress', cb);
  })
}

async function readArticle(ln, name) {
  try {
    const meta = await getArticleMeta(ln, name);
    const pageID = meta.query.search[0].pageid;
    const article = await getArticleContent(ln, pageID);
    const htmlTxt = article.query.pages[pageID].extract;
    const plainTxt = htmlToText.fromString(htmlTxt, { wordwrap: 130 })
    const allParagraphs = plainTxt.split(/\n\s+/g)
    console.log('\nPress N to read next paragraph. Press E to exit reading mode\n');
    await readPerParagraph(allParagraphs);
  } catch(err) {
    console.log('Oops, an error occured. Please try again later');
  }
}

function start(question) {
  readline.question(question, async (command) => {
    const args = command.split(/\s+/g);

    if (args.length < 1) {
      return start(help());
    }

    switch(args[0].toUpperCase()) {
      case CMD_READ: {
        if (args.length < 2) {
          start(help());
        }
        const name = args.slice(1).join('_');
        await readArticle(lang, name);
         start('\nEnter Command: ');
        break;
      }
      case CMD_RANDOM: {
        const rand = await randomArticle()
        const title = rand.query.random[0].title;
        await readArticle(lang, title);
        start('\nEnter Command: ');
        break;
      }
      case CMD_ABOUT: {
        if (args.length < 2) {
          start(help());
        }
        const name = args.slice(1).join('_');
        const about = await getAbout(lang, name);
        console.log();
        console.log(about)
        start('\nEnter Command: ');
        break;
      }
      case CMD_QUIT: {
        quit();
        break;
      }
      default:
      case CMD_HELP: {
        start(help())
        break;
      }
    }
  })
}

// start the app
start(help());
