// simple runner for src/antrax

import _ from 'lodash'
import { antrax } from './index'
// import { getCfg, getCfgInfos, readCfg } from './lib/pouch'
import { checkConnection, initialReplication, cloneDB, streamDB, getDB } from './lib/pouch'
import { segmenter } from './lib/segmenter'
import {accents as ac, tense, voice, mood, vowels, weaks, affixes, apiaugs, augs, eaug, augmods, apicompats, contrs} from './lib/utils'
const d = require('debug')('app')
const fse = require('fs-extra');

let util = require('util');
const path = require('path')
let log = console.log
let env = process.env.NODE_ENV
// let all = {startkey: 'α', endkey: 'ῳ'}

let MemoryStream = require('memorystream');

let only, printf
let compound = false
let wordform = process.argv.slice(2)[0] // || 'ἀργυρῷ' // false;
let thirdarg = process.argv.slice(3)[0] || false;

if (thirdarg == 'comp') compound = true
else if (thirdarg == 'insp') printf = true
else only = thirdarg

console.time("queryTime");

// flex, comp - already run
// let upath = path.resolve(process.env.HOME, '.config/Biblos.js (development)')
let upath = path.resolve(process.env.HOME, '.config/Biblos.js')
// let upath = path.resolve(process.env.HOME, '.config/Biblos-devel.js')
let apath = '/home/michael/a/atemplate'
let dnames
dnames = ['wkt']
// dnames = ['lsj']
// dnames = ['dvr']
// dnames = ['wkt', 'local']
// dnames = ['wkt', 'lsj', 'dvr', 'local', 'souda', 'terms']
dnames = ['wkt', 'lsj', 'dvr', 'souda', 'terms']
// dnames = ['wkt', 'lsj', 'terms']
// dnames = ['souda']

let cfg = [{dname: 'terms'}, {dname: 'flex'}, {dname: 'wkt'}, {dname: 'lsj'}, {dname: 'dvr'}, {dname: 'souda'} ]
if (wordform == 'install') {
  log('____default installing start');
  let batch_size = 500
  initialReplication(upath, cfg, batch_size)
    .then(cfg=>{ log('___run-cfg', cfg) })
    .catch(err=>{ log('ERR-initReplication', err.message) })

} else if (wordform == 'stream') {
  // yarn start stream &> /dev/null
  let dname = 'terms'
  let batch_size = 500
  let stream = new MemoryStream()
  streamDB(upath, dname, stream, batch_size)
    .then(function (res) {
      console.log('Hooray the stream replication is complete!');
      log('____streamed', res)
    }).catch(function (err) {
      console.log('oh no an error', err.message);
    })
} else if (wordform == 'get') {
  let wf = 'βιβλι'
  let dname = 'wkt'
  checkConnection(upath, dnames)
  getDB(wf, dname)
    .then(function(res) {
      log('getDB', wf, res)
    })
    .catch(err=> {
      log('ERR get db', err)
    })
} else {
  log('=DNAMES=', dnames)
  checkConnection(upath, dnames)

  antrax(wordform, compound, only)
    .then(res => {
      if (!res) return log('no result')
      print (res)
      console.timeEnd("queryTime");
    }).catch(function (err) {
      console.log('ANTRAX-ERR', err)
    })
}

function print (res) {
  let chains = res.chains
  chains.forEach(chain=>{
    d('result-chain---------------------->')
    d(chain)
    let rdicts = _.flatten(chain.map(seg=> { return seg.dicts.map(dict=> { return [dict.rdict, dict.dname].join('-') }) }))
    d('result-dicts--->')
    d(rdicts)
    // let dicts = _.flatten(chain.map(seg=> { return seg.dicts  }))
    // d(dicts)
    let rplains = chain.map(seg=> { return seg.dicts.map(dict=> { return dict.plain }) })
    d('result-plains--->')
    d(_.flatten(rplains))

    let rfls = chain.map(seg=> { return seg.dicts.map(dict=> { return dict.fls }) })
    d('result-fls--->')
    d(_.compact(_.flatten(rfls)))
  })

  if (res.terms) res.terms.forEach(term=> { delete term.trns })
  if (res.terms) log('TERMS:', res.terms)

}

function insp (o) {
  console.log(util.inspect(o, false, null, true));
}


// } else if (wordform == 'clone_') {
//   // // беру резмер db из cfg и проверяю размер файла периодически. Ну очень криво, но...
//   // let dname = 'terms'
//   // let termdb = _.find(cfg, db=> { return db.dname == dname})
//   // let timerId = setInterval(() => log('--------------tick'), 1000);
//   // // setTimeout(() => { clearInterval(timerId); log('-----------------stop'); }, 10000);
//   // // var stats = fse.statSync("myfile.txt")
//   // // var fileSizeInBytes = stats["size"]
//   // cloneDB(upath, cfg, dname)
//   //   .then(res=>{ log('___run-clone', res), clearInterval(timerId) })
//   //   .catch(err=>{ log('ERR-cloneDB', err.message) })
// } else if (wordform == 'cfg') {
//   // let cfg = readCfg(apath)
//   // log('__cfg', cfg, cfg.length)
// } else if (wordform == 'infos') {
//   // let cfg = getCfg(apath, upath)
//   // let dnames = cfg.map(dict=> { return dict.dname })
//   // checkConnection, (upath, dnames)
//   getCfgInfos(upath)
//     .then(infos=> {
//       log('___db-infos', infos, '\n total dbs:', infos.length)
//     })
