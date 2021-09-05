import { h, x } from "./esrc.js";

const BASE_URL = "https://en.wikipedia.org/w/api.php" + "?origin=*";
const ARTICLE_URL = "https://en.wikipedia.org/wiki/";
let article_url = "";
let article_title = "";

const input_elements = {
    select: document.querySelector('#wiki-select'),
    button: document.querySelector('#wiki-button')
};
const controller = document.querySelector('#wiki-controller');

const synth = window.speechSynthesis;
let voices = [];

let used_once = false;

/**
 * Init app.
 */
async function init() {
    init_voices();

    controller.innerText = 'Ready!';
    input_elements.button.addEventListener('click', activate_speech);
}

/**
 * Requests an article, updates the controller, and speaks the text.
 */
async function activate_speech() {
    synth.cancel();
    controller.innerText = 'Fetching fact...'

    let text = await get_article_paragraph();
    
    const atag = x('a', {
        href: article_url,
        innerText: article_title,
        target: "__blank"
    });
    controller.innerHTML = '';
    controller.appendChild(atag);

    if (!used_once) {
        used_once = true;
        input_elements.button.innerText = 'go again?';
    }

    let voice;

    for (let i = 0; i < voices.length; i++) {
        const v = voices[i];
        if (v.name == input_elements.select.selectedOptions[0].dataset.name) {
            voice = v;
            break;
        }
    }

    speak_text(text, voice);
}

/**
 * Initialize the voices and selection.
 */
async function init_voices() {
    // Load voices

    voices = await get_voices();

    for (let i = 0; i < voices.length; i++) {
        const voice = voices[i];

        const option = document.createElement('option');
        option.textContent = `${voice.name} (${voice.lang})`;
        option.dataset.name = voice.name;
        option.dataset.lang = voice.lang;

        input_elements.select.appendChild(option);
    }
}

/**
 * Load voices
 */
function get_voices() {
    return new Promise((resolve, reject) => {
        window.setInterval(() => {
            let pending_voices = synth.getVoices();
            if (pending_voices.length != 0) {
                resolve(pending_voices.filter(e=>(e.lang.slice(0, 2) == 'en' && !e.name.startsWith("Google"))));
            }
        }, 20);

        window.setTimeout(() => {
            if (voices.length == 0) {
                controller.innerText = "Sorry, I couldn't find any voices on this device.";
                throw new Error('No voices found!')
            }
        }, 5000);
    });
}

/**
 * Speaks a piece of text.
 * @param {String} text Uttered text.
 * @param {SpeechSynthesisVoice} voice Voice.
 */
function speak_text(text, voice) {
    synth.cancel();

    let utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;

    synth.speak(utterance);
}

/**
 * Return a random article title from Wikipedia.
 * @returns String
 */
async function get_article_title() {
    let url = generate_query({
        action: "query",
        format: "json",
        list: "random",
        rnnamespace: "0"
    });

    return fetch(url)
        .then(rep => rep.json())
        .then(rep => {
            article_title = rep.query.random[0].title;
            article_url = ARTICLE_URL + article_title.replace(" ", "_");
            return article_title;
        })
        .catch(err => { console.log(error); return undefined; });
}

/**
 * Return a random article's paragraph from Wikipedia.
 * @returns String
 */
async function get_article_paragraph() {
    return get_article_title()
        .then(title => {
            let url = generate_query({
                action: "parse",
                prop: "revisions",
                page: title.replace(" ", "_"),
                prop: "text",
                format: "json",
                formatversion: "2"
            });

            return fetch(url)
                .then(rep => rep.json())
                .then(rep => {
                    let html = h`${rep.parse.text}`;

                    let coords = html.querySelector('#coordinates');
                    if (coords) {
                        coords.remove();
                    }

                    let ptags = html.querySelectorAll('.mw-parser-output p:not(h2 ~ p)');
                    // let ptags = h`${rep.parse.text}`.querySelectorAll('.mw-parser-output p');

                    let text = "";
                    for (const p in ptags) {
                        text += ptags[p].textContent || '';
                    }

                    text = text.replace(/(This .*? can help Wikipedia by expanding it.)|(\[\d+?\])/g, '');

                    return text;
                })
        });
}

/**
 * Return MediaWiki URL query string from parameters.
 * @param {Object} params Parameters.
 * @returns String
 */
function generate_query(params) {
    let url = BASE_URL;
    Object.keys(params).forEach(key => { url += "&" + key + "=" + params[key]; });
    return url;
}

init();
if (synth.onvoiceschanged != undefined) {
    synth.onvoiceschanged = init;
}