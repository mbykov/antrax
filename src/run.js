// simple runner for src/antrax

import _ from 'lodash'
import { antrax } from './index'
import { checkConnection, initialReplication, cloneDB, streamDB, getDB, getTerms } from './lib/pouch'
import { segmenter } from './lib/segmenter'
import {accents as ac, tense, voice, mood, vowels, weaks, affixes, apiaugs, augs, eaug, augmods, apicompats, contrs} from './lib/utils'
const d = require('debug')('app')
// const fse = require('fs-extra');

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

// let upath = path.resolve(process.env.HOME, '.config/Biblos.js (development)')
let upath = path.resolve(process.env.HOME, '.config/Biblos.js')
let apath = '/home/michael/a/atemplate'

let dnames
dnames = ['wkt']
// dnames = ['wkt', 'lsj', 'dvr', 'souda', 'terms']
// dnames = ['wkt', 'dvr', 'terms']
// dnames = ['wkt', 'terms']
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
  let dname = thirdarg
  let batch_size = 500
  let stream = new MemoryStream()
  streamDB(upath, dname, stream, batch_size)
    .then(function (res) {
      console.log('Hooray the stream replication is complete!');
      log('____streamed', res)
    }).catch(function (err) {
      console.log('oh no an error', err.message);
    })
} else if (wordform == 'getid') {
  let wf = thirdarg
  // let wf = 'γαθοεργ'
  let dname = 'wkt'
  dnames  = [dname]
  checkConnection(upath, dnames)
  getDB(wf, dname)
    .then(function(res) {
      log('=getID=', wf, res)
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
