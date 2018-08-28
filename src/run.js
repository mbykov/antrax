// simple runner for src/antrax

import _ from 'lodash'
import { clause, antrax, enableDBs } from './index'
// import { getFlex, getDict, createDBs, queryDBs } from './lib/pouch'
// import { enableDBs } from './lib/pouch'
import { segmenter } from './lib/segmenter'
import {accents as ac, tense, voice, mood, vowels, weaks, affixes, apiaugs, augs, eaug, augmods, apicompats, contrs} from './lib/utils'

let util = require('util');

const path = require('path')
let only = process.argv.slice(3)[0] || false;

let log = console.log
// let all = {startkey: 'α', endkey: 'ῳ'}

let wordform = process.argv.slice(2)[0] // || 'ἀργυρῷ' // false;
let env = process.env.NODE_ENV

console.time("queryTime");

// let upath = path.resolve(__dirname, '../../')
let upath = path.resolve(process.env.HOME, '.config/MorpheusGreek (development)')
let apath = path.resolve(__dirname, '../../egreek')
enableDBs(upath, apath)

antrax(wordform).then(chains => {
  if (only && only == 'log') chains.forEach(chain => { log('C:'), insp(chain)  })
  // else chains.forEach(chain => { log('C:'), insp(chain)  })
  else insp(chains)
  console.timeEnd("queryTime");
}).catch(function (err) {
  console.log('ANTRAX-ERR', err)
})

function insp (o) {
  console.log(util.inspect(o, false, null, true));
}
