// simple runner for src/antrax

import _ from 'lodash'
import { clause, antrax, enableDBs } from './index'
// import { getFlex, getDict, createDBs, queryDBs } from './lib/pouch'
// import { enableDBs } from './lib/pouch'
import { segmenter } from './lib/segmenter'
import {accents as ac, tense, voice, mood, vowels, weaks, affixes, apiaugs, augs, eaug, augmods, apicompats, contrs} from './lib/utils'

const path = require('path')
// const orthos = require('../../orthos') // publish - поправить версию
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
  if (only && only == 'log') chains.forEach(chain => { log('C:', chain) , log('D:', chain[chain.length-2].dicts), log('F:', chain[chain.length-1].flexes) })
  else chains.forEach(chain => { log('C:', chain) , log('F:', chain[chain.length-1].flexes) })
  console.timeEnd("queryTime");
}).catch(function (err) {
  console.log('ANTRAX-ERR', err)
})
