//
import _ from 'lodash'
import { createCfg, createCfgInfos, getTerms, getFlex, queryDBs, setDBs, updateDB, readDB, delDB } from './lib/pouch'
import { segmenter } from './lib/segmenter'
import { makeChains } from './lib/chains'
import { accents, vowels, aspirations, coronis, corvowels, stressed } from './lib/utils'
import util from 'util'
const path = require('path')
import {oxia, comb, plain, strip} from 'orthos'
// import {oxia, comb, plain, strip} from '../../../greek/orthos'

let log = console.log
const d = require('debug')('app')

export function checkConnection(upath, dnames) { setDBs(upath, dnames) }
export function getCfg(apath, upath) { return createCfg(apath, upath) }
export function getCfgInfos(upath) { return createCfgInfos(upath) }
export function readDictionary(upath, dname) { readDB(upath, dname) }
export function delDictionary(upath, dname) { delDB(upath, dname) }

// nav.js, i.e. remote пока
export function updateCurrent (upath, docs) {
  let dname = 'local'
  return updateDB(upath, dname, docs)
}

export function antrax (wf, compound, only) {
  let cwf = corrStr(wf)
  cwf = cwf.replace(/-/g, '')
  let pwf = plain(cwf)

  let sgms = segmenter(cwf)
  let strong = false
  if (compound && compound == 'strong') strong = true, compound = false
  else if (compound) sgms = _.filter(sgms, sgm=> { return sgm.length > 2 })

  // sgms = _.filter(sgms, sgm=> { return sgm.length > 2 })

  // lasts - segments for flexes:
  let lasts = _.uniq(sgms.map(sgm =>  { return sgm[sgm.length-1] }))
  // segments for dicts:
  let nonlasts = _.uniq(_.flatten(sgms.map(sgm =>  { return sgm.slice(0, -1) }) ))
  let plainsegs = _.uniq(_.compact(nonlasts.map(nonlast => { return plain(nonlast) }) ))

  let cwfs = addTerms(cwf)
  plainsegs.push(cwf) // for terms in regular DBs, but not in special 'terms' DB
  // примеры корониса: - может ли быть во флексии два и более символов, и последний - коронис?
  // εὕρημ᾽ -

  d('cwfs:', cwf, cwfs)
  // d('sgms:', JSON.stringify(sgms))
  // d('sgms:', sgms)
  d('lasts:', lasts.toString())
  d('plainsegs:', plainsegs.toString())

  // это - только для анализа terms:
  // plainsegs = ['δῆτα'] // !!!!!!!!!!!!!!!

  return Promise.all([
    getTerms(cwfs),
    queryDBs(plainsegs),
    getFlex(lasts)
    // , getComp(plainsegs)
  ]).then(function (res) {
    let terms = _.flatten(res[0])
    let dicts = _.flatten(res[1])
    d('dicts all---->', dicts.length)

    let dterms = _.filter(dicts, dict => { return dict.term && cwfs.includes(dict.term) })
    dicts = _.filter(dicts, dict => { return !dict.term })

    d('terms---->', terms.length)
    terms.push(...dterms)

    let rdterms = _.uniq(dterms.map(dict => { return dict.term}))
    d('rdterms---->', rdterms)
    d('dterms---->', dterms.length)
    d('all terms---->', terms.length)

    let flexes = _.flatten(res[2])

    // dicts = _.filter(dicts, dict => { return !dict.indecl })
    let dplains = _.uniq(dicts.map(dict => { return dict.plain}))
    d('dictplains---->', dplains.toString())
    d('dicts.size---->', dicts.length)
    // let complains = _.uniq(comps.map(dict => { return dict.plain}))
    // d('complains---->', complains.toString())
    // d('complains.size---->', complains.length)

    let prefs = _.filter(dicts, dict => { return dict.pref})
    let pprefs = _.uniq(prefs.map(dict => { return dict.plain}))
    d('prefs---->', pprefs.toString(), prefs.length)
    let sufs = _.filter(dicts, dict => { return dict.suf})
    let psufs = _.uniq(sufs.map(dict => { return dict.plain}))
    d('sufs---->', psufs.toString(), sufs.length)

    let kdicts = _.filter(dicts, dict => { return dict.plain == only })
    d('kdicts---->', kdicts.length)

    d('singles:', sgms.length)

    let chains = makeChains(sgms, dicts, flexes, compound, only)
    d('total chains', chains.length)
    // return {chains: [], terms: []}

    let bests = selectBest(chains, compound)
    d('bests =>', bests.length)
    if (bests.length) chains = bests

    // refine results (i.e. verbs only) with changed stems:
    let chaindicts = _.flatten(chains.map(chain=> { return _.flatten(chain.map(sec=> { return sec.dicts })) }))
    // chaindicts.forEach(dict=> { delete dict.keys, delete dict.trns })
    chaindicts.forEach(dict=> { delete dict.keys })
    let wktverbs = _.filter(chaindicts, dict=> { return dict.verb && dict.dname == 'wkt' })
    let wktplains = wktverbs.map(dict=> { return dict.plain })
    return queryDBs(wktplains)
      .then(res=>{
        let refined = _.flatten(res)
        // непонятно, dict.dict, а если fit = term?
        refined = _.filter(refined, dict=> { return dict.dict && dict.dname != 'wkt' })
        refined.forEach(dict=> { delete dict.keys })
        let fits = []
        refined.forEach(fit=> {
          let wkt = _.find(wktverbs, wkt=> { return fit.dict == comb(wkt.rdict) })
          if (!wkt) return
          fit.fls = wkt.fls
          fits.push(fit)
        })

        // log('REFINED', refined.length)
        chains.forEach(chain=> {
          chain.forEach(sec=> {
            let secwkts = _.filter(sec.dicts, dict=> { return dict.verb && dict.dname == 'wkt' })
            if (!secwkts.length) return
            let secdicts = _.filter(sec.dicts, dict=> { return !dict.verb })
            secwkts.push(...secdicts)
            secwkts.push(...fits)
            sec.dicts = secwkts
          })
        })

        // terms дает много очень лишнего в chains, так нельзя, но как можно? напр., артикль τῶν дает τ, и пиздец
        // нужен пример, почему нельзя только terms - например, ἦσαν
        // но просто убрать это нельзя! см. τῶν
        // if (terms.length) chains = []
        let result = { chains: chains, terms: terms }
        if (chains.length && compound) result.compound = true
        return result
      })

  })
}

function selectBest(chains, compound) {
  let exacts = []
  chains.forEach(chain=> {
    let possible = false
    chain.forEach(sec=> {
      sec.dicts.forEach(dict=> { if (dict.possible) possible = true })
    })
    if (!possible) exacts.push(chain)
  })
  if (exacts.length) return exacts
  else return chains
}

function cleanStr(row) {
  let clean = row.trim()
  clean = clean.replace(/ᾰ/gi, 'α').replace(/ᾱ/gi, 'α').replace(/ῑ/gi, 'ι').replace(/ῐ/gi, 'ι').replace(/ῠ/gi, 'υ').replace(/ῡ/gi, 'υ')
  clean = clean.replace(/Ῐ/gi, 'Ι').replace(/Ῑ/gi, 'Ι')
  clean = clean.replace(/̆/gi, '')
  return clean
}

function corrStr(wf) {
  let clwf = cleanStr(wf)
  let cwf = comb(clwf)
  return oxia(cwf)
}

function addTerms(cwf) {
  let cwfs = []
  let last = _.last(cwf)
  if (last == coronis) {
    let stress = stressed(cwf)
    corvowels.forEach(vow=> {
      let clean = cwf.slice(0, -1)
      clean = [clean, vow].join('')
      if (!stress) clean = [clean, accents.oxia].join('')
      cwfs.push(clean)
    })
  } else {
    cwfs.push(cwf)
  }
  return cwfs
}
