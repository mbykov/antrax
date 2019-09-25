// simple runner for src/antrax

import _ from 'lodash'
import { antrax, getCfg, checkConnection, readDictionary } from './index'
import { setDBs } from './lib/pouch'
import { segmenter } from './lib/segmenter'
import {accents as ac, tense, voice, mood, vowels, weaks, affixes, apiaugs, augs, eaug, augmods, apicompats, contrs} from './lib/utils'
const d = require('debug')('app')

let util = require('util');
const path = require('path')
let log = console.log
let env = process.env.NODE_ENV
// let all = {startkey: 'α', endkey: 'ῳ'}

let only, printf
let compound = false
let wordform = process.argv.slice(2)[0] // || 'ἀργυρῷ' // false;
let thirdarg = process.argv.slice(3)[0] || false;

if (thirdarg == 'comp') compound = true
else if (thirdarg == 'insp') printf = true
else only = thirdarg

console.time("queryTime");

// flex, comp - already run
let upath = path.resolve(process.env.HOME, '.config/Biblos.js (development)')
let apath = '/home/michael/a/atemplate'
let dnames
dnames = ['wkt']
// dnames = ['lsj']
// dnames = ['dvr']
// dnames = ['wkt', 'local']
dnames = ['wkt', 'lsj', 'dvr', 'local', 'souda']
// dnames = ['wkt', 'lsj', 'terms']
// dnames = ['souda']

if (wordform == 'install') {
  getCfg(apath, upath)
    .then(cfg=> {
      let dnames = cfg.map(dict=> { return dict.dname })
      checkConnection(upath, dnames)
      wordform  = 'ἀλλότριος'
      antrax(wordform, compound, only)
        .then(res => {
          if (!res) return log('no result')
          print (res)
          // log('INSTALL CFG', cfg)
          console.timeEnd("queryTime");
        }).catch(function (err) {
          console.log('ANTRAX-ERR', err)
        })

    })
} else {
  log('=DNAMES=', dnames)
  setDBs(upath, dnames)

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
