// import sum from './sum'
import _ from 'lodash'
import { clause, antrax, enableDBs } from './index'
// import { getFlex, getDict, createDBs, queryDBs } from './lib/pouch'
// import { enableDBs } from './lib/pouch'
import { segmenter } from './lib/segmenter'
import {accents as ac, tense, voice, mood, vowels, weaks, affixes, apiaugs, augs, eaug, augmods, apicompats, contrs} from './lib/utils'

const path = require('path')

let log = console.log
// let all = {startkey: 'α', endkey: 'ῳ'}

let wordform = process.argv.slice(2)[0] // || 'ἀργυρῷ' // false;
let env = process.env.NODE_ENV

// simple runner for terms

console.time("queryTime");

let upath = path.resolve(process.env.HOME, '.config/MorpheusGreek (development)')
let apath = path.resolve(__dirname, '../../egreek')
enableDBs(upath, apath)


let wfs = [wordform]
clause(wfs)
  .then(terms => {
    log('ANTRAX-TERMS:', terms)
    console.timeEnd("queryTime");
  })
