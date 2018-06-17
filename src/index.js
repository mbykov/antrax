// import sum from './sum'
import _ from 'lodash'
import {log} from './lib/utils'
import { clause, antrax} from './antrax'
// import { getFlex, getDict, createDBs, queryDBs } from './lib/pouch'
import { enableDBs } from './lib/pouch'
import { segmenter } from './lib/segmenter'
import {accents as ac, tense, voice, mood, vowels, weaks, affixes, apiaugs, augs, eaug, augmods, apicompats, contrs} from './lib/utils'

const path = require('path')
const orthos = require('../../orthos') // publish - поправить версию

let clog = console.log
// let all = {startkey: 'α', endkey: 'ῳ'}

let wordform = process.argv.slice(2)[0] // || 'ἀργυρῷ' // false;
let env = process.env.NODE_ENV

// simple runner for src/antrax

console.time("queryTime");

function runner(query) {
  // morpheus-greek default dbs  :
  // NB - прочитать в конфиге :
  // прочитать cfg?
  let upath = path.resolve(__dirname, '../../')
  enableDBs(upath)

  let wfs = query.split(' ')
  if (wfs.length > 1) {
    clause(wfs)
    .then(terms => {
      clog('ANTRAX-TERMS:', terms)
    })
  } else if (wfs) {
    clog('ANTRAX')
    antrax(wordform).then(chains => {
      // if (env !== 'test') chains.forEach(chain => { clog('C:', chain) , clog('F:', chain[chain.length-1].flexes) })
      if (env !== 'test') chains.forEach(chain => { clog('C:', chain) , clog('D:', chain[chain.length-2].dicts), clog('F:', chain[chain.length-1].flexes) })
      console.timeEnd("queryTime");
    }).catch(function (err) {
      console.log('ANTRAX-ERR', err)
    })
  } else {
    return
  }
}

runner(wordform)
