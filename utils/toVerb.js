/*

*/


let _ = require('underscore');
let path = require('path');
let fs = require('fs');
let orthos = require('../../orthos');
var util = require('util');

let push = process.argv.slice(2)[0] || false;
let only
if (push == 'true') push = true
else if (push) {
    only = push
    push = false
    // only = orthos.toComb(only);
}

let onlypush = process.argv.slice(3)[0] || false;
if (onlypush == 'true') push = true

let dpath = '../test/tmp.txt';

const morphs = ['title', 'sg.1', 'sg.2', 'sg.3', 'pl.1', 'pl.2', 'pl.3', '', '', '', ]

console.time('_gramm');
run()
console.timeEnd('_gramm');

function run() {
    let doc = getTmp(dpath)
    console.log(util.inspect(doc, showHidden=false, depth=null, colorize=true))
    log('PUSH', push)
    if (push) appendTest(doc)
}

function getTmp(dpath) {
    let fpath = path.join(__dirname, dpath);
    let text = fs.readFileSync(fpath,'utf8').trim();
    let strs = text.split('\n');
    let doc = cleanRows(strs)
    return doc
}

function cleanRows(strs) {
    let doc = {}
    let start = 0
    let title
    strs.forEach(function(str, idx) {
        if (!str) return
        if (str[0] == '#') return
        str = str.replace(/-/g, '')
        if (str[0] == '*') {
            title = str.replace('*', '').trim()
            start = idx
            return
        }
        if (!title) throw new Error('NO TITLE')
        let forms = str.split('/')
        forms.forEach(function(form) {
            // let test = {}
            let key = morphs[idx-start]
            // test[key] = form.trim()
            form = form.trim()
            if (!doc[title]) doc[title] = {}
            doc[title][form] = key
        })
    })
    return doc
}

function appendTest(doc) {
    let tpath = '../test/verbs.txt'
    tpath = path.join(__dirname, tpath);
    let text = fs.readFileSync(tpath,'utf8').trim();
    let strs = text.split('\n');
    log('OLD', strs.length)
    let json = JSON.stringify(doc)
    log('NEW TEST:', json)
    strs.push(json)
    let news = strs.join('\n')
    fs.writeFile(tpath, news, function(err) {
        if(err) return log(err)
        log("The file was saved, ", strs.length)
    })
}

let mods = {
    'present active indicative': 'act.pres.ind',
    'imperfect active indicative': 'act.impf.ind',
    'present active middle and passive': 'mid-pass.pres.ind',
    'imperfect active middle and passive': 'mid-pass.impf.ind',
    'aorist active indicative': 'act.aor.ind',
    'future active indicative': 'act.fut.ind',
    'future middle and passive indicative': 'mid-pass.fut.ind',
    '': '',
    '': '',
}



// rows = rows.slice(0, 1000);
// let arr, dict;
// let docs = []
// rows.forEach(function(row, idx) {
// })


function log() { console.log.apply(console, arguments); }
