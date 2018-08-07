// import sum from './sum'
import _ from 'lodash'
import { log } from './lib/utils'
import { getTerms, getFlex, queryDBs, setDBs } from './lib/pouch'
import { segmenter } from './lib/segmenter'
import { parseVerb, parseName } from './lib/mutables'
// import { accents as ac, tense, voice, mood, vowels, weaks, affixes, apiaugs, augs, eaug, augmods, apicompats, contrs } from './lib/utils'
import { vowels, strongs, voice } from './lib/utils'
import { strong } from './lib/augments'
import util from 'util'

// process.EventEmitter = require('events').EventEmitter
const path = require('path')
// const orthos = require('../../orthos')
const orthos = require('orthos')

let clog = console.log

let wordform = process.argv.slice(2)[0] // || 'ἀργυρῷ' // false;
let env = process.env.NODE_ENV

export function enableDBs (upath, apath) {
  setDBs(upath, apath)
}

export function clause (wfs) {
  let keys = wfs.map(wf => orthos.toComb(wf))
  let dkeys = keys.map(key => { return orthos.downcase(key) })
  return getTerms(dkeys)
}

export function antrax (wordform) {
  if (!wordform) return new Promise(function() {})

  let clstr = cleanStr(wordform)
  let comb = orthos.toComb(clstr)
  comb = orthos.downcase(comb)
  let sgms = segmenter(comb)
  let clean = orthos.plain(comb)

  // segments for flexes:
  let lasts = _.uniq(sgms.map(sgm =>  { return sgm[sgm.length-1] }))
  // lasts.push(comb) // это, наверное, будет не нужно при поиске terms регулярно
  log('lasts', lasts)

  // segments for dicts:
  let nonlasts = _.uniq(_.flatten(sgms.map(sgm =>  { return sgm.slice(0, -1) }) ))
  let pnonlasts = _.uniq(_.compact(nonlasts.map(nonlast => { return orthos.plain(nonlast) }) ))
  log('NONlast:', pnonlasts.toString())

  let added = addedStems(pnonlasts)
  log('Added:', added.toString())

  let plainsegs = (added.length) ? _.uniq(pnonlasts.concat(added)) : pnonlasts
  log('Psegs:', plainsegs.toString())

  return getFlex(lasts)
    .then(fls => {
      return queryDBs(plainsegs)
        .then(rdocs => {
          let dicts = _.flatten(rdocs)
          return main(comb, plainsegs, sgms, pnonlasts, fls, dicts)
        })
    })
} // export antrax


// ADDED
function addedStems(wforms) {
  let plain, first, added = []
  wforms.forEach(wf => {
    first = _.first(wf)
    plain = orthos.plain(wf)
    // let firsts = _.uniq([plain.slice(0,1), plain.slice(0,2), plain.slice(0,3), plain.slice(0,4), plain.slice(0,5)]) // aor. ind from aor others
    // // firsts = _.filter(firsts, first => { return first != plain })
    // firsts.forEach(first => {
    //   for (let dict in weaks) {
    //     let reals = weaks[dict]
    //     if (!reals.includes(first)) continue
    //     let add = [dict, plain.slice(first.length)].join('')
    //     // added.push(add)
    //   }
    // })

    let weaks = strong[first]
    if (!vowels.includes(first)) {
      let add = ['ε', plain].join('') // aor.sub, opt, impf for consonants
      added.push(add)
    } else if (weaks) {
      weaks.forEach(weak => {
        let add = [weak, wf.slice(1)].join('') // impfs
        added.push(add)
      })
    }
  })
  return _.uniq(added)
}

function main(comb, plainsegs, sgms, pnonlasts, flexes, dicts) {
  dicts = _.filter(dicts, dict => { return !dict.indecl })
  dicts = _.filter(dicts, dict => { return dict.rdict })
  log('dicts--->', dicts.length)
  let kdicts = _.filter(dicts, dict => { return dict.plain == 'ων'})
  log('kdicts---->', kdicts.length)
  log('flexes--->', flexes.length)
  let kflexes = _.filter(flexes, fl => { return fl.flex == 'ον'})
  log('kflexes--->', kflexes.length)

  let segdicts = distributeDicts(plainsegs, dicts)
  let chains = makeChains(sgms, segdicts, flexes)

  addDicts(chains, pnonlasts, segdicts)

  let fulls = fullChains(chains)
  log('chains: ', chains.length, 'fulls: ', fulls.length)
  if (fulls.length) chains = fulls
  else return []

  // соответствие dicts и flex, added dicts
  let cleans = filterDictFlex(chains)
  let bests = selectLongest(cleans)
  log('main =>', fulls.length)

  //compounds
  bests.forEach(segs => {
    if (segs.length == 4) {
      segs.forEach(segment => {
        if (segment.seg == 'ο') segment.dicts = [{spec: true, rdict: 'ο', trns: ['o-connector'] }]
      })
    }
  })

  // убрать - д.б. uniqNames
  bests.forEach(best => {
    _.last(best).flexes.forEach(flex => { delete flex.dicts, delete flex.flex, delete flex.a, delete flex.h, delete flex.rgend, delete flex.rdicts })
    // DELETES - здесь проходит
  })
  return bests
}


// предварительно распределяю dicts по всем plain-сегментам, включая добавочные :
function distributeDicts (plainsegs, dicts) {
  let segdicts = {}
  plainsegs.forEach(pseg => {
    let sdicts = _.filter(dicts, dict => { return pseg === dict.plain })
    segdicts[pseg] = sdicts
  })
  return segdicts
}

// отбрасываю chains без flexes:
function makeChains (sgms, segdicts, flexes) {
  let psegs, chains = []
  sgms.forEach(segs => {
    let lastseg = _.last(segs)
    let segflexes = _.filter(flexes, flex => { return flex.flex === lastseg} )
    if (!segflexes.length) return

    psegs = segs.slice(0, -1)
    let chain = []
    psegs.forEach((seg, idx) => {
      let pseg = orthos.plain(seg)
      let pdicts = segdicts[pseg]
      let prfdicts
      if (idx < psegs.length-1) {
        pdicts = _.filter(pdicts, pdict => { return pdict.pref || pdict.name })
        prfdicts = _.filter(pdicts, pdict => { return pdict.pref })
        if (prfdicts.length) pdicts = prfdicts
      }
      let oseg = {seg: seg, dicts: pdicts }
      chain.push(oseg)
    })

    chain.push({seg: lastseg, flexes: segflexes})
    chains.push(chain)
  })
  return chains
}

// ADDED
function addDicts(chains, pnonlasts, segdicts) {
  chains.forEach(segs => {
    let penult = segs[segs.length-2]
    let seg = penult.seg
    seg = orthos.plain(seg)
    let first = _.first(seg)
    let sdicts = _.clone(penult.dicts)
    let firsts = _.uniq([seg.slice(0,1), seg.slice(0,2), seg.slice(0,3), seg.slice(0,4), seg.slice(0,5)])
    // firsts = _.filter(firsts, first => { return first != seg })
    // firsts.forEach(first => {
    //   if (first != 'ῳ') return
    //   for (let dict in weaks) {
    //     let reals = weaks[dict]
    //     if (!reals.includes(first)) continue
    //     let added = [dict, seg.slice(first.length)].join('')
    //     let adicts = segdicts[added]
    //     addDictCarefully(pnonlasts, sdicts, adicts, 'weak')
    //   }
    // })

    let weaks = strong[first]
    if (!vowels.includes(first)) {
      let added = ['ε', seg].join('') // aor.sub, opt, impf from ind
      let adicts = segdicts[added]
      addDictCarefully(pnonlasts, sdicts, adicts, 'added')
    } else if (first == 'ε') { // pas.aor.sub - βλέπω  - ἔβλεψα - ἐβλεφθῶ - dict plain βλε
      if (seg.length < 2) return
      let added = seg.slice(1)
      let adicts = segdicts[added]
      addDictCarefully(pnonlasts, sdicts, adicts, 'sliced')
    } else if (weaks) {
      weaks.forEach(weak => {
        let stem = seg.slice(1)
        let added = [weak, stem].join('')
        let adicts = segdicts[added]
        addDictCarefully(pnonlasts, sdicts, adicts, 'sliced')
      })
    }
    penult.dicts = _.uniq(_.compact(_.flatten(sdicts)))
  })
}

function addDictCarefully(pnonlasts, sdicts, adicts, mark) {
  if (!adicts || !adicts.length) return
  adicts.forEach(adict => {
    if (!pnonlasts.includes(adict.plain)) adict[mark] = true
  })
  sdicts.push(adicts)
}

function fullChains(chains) {
  let fulls = []
  chains.forEach(segs => {
    let full = true
    let dsegs = segs.slice(0, -1)
    dsegs.forEach(seg => {
      if (!seg.dicts.length) full = false
    })
    if (full) fulls.push(segs)
  })
  return fulls
}


// MAIN
function filterDictFlex (rchains) {
  let chains = []
  rchains.forEach(rchain => {
    if (rchain.length > 2) return // ============================================== убрать
    let lastseg = _.last(rchain)
    let seg = lastseg.seg
    let flexes = lastseg.flexes
    let segs = rchain.slice(0, -1)
    if (!segs.length) return

    let last = _.last(segs)
    // BUG: жуткий баг, неизвестно откуда  - circulars, вместо обычных dict => npm start ἐμεόμενος
    // last.dicts = _.filter(last.dicts, dict => { return dict.rdict })

    // last.dicts.forEach(dict => { dict.dict = orthos.toComb(dict.rdict) } )

    let vchains = parseVerb(seg, segs, flexes)
    chains.push(vchains)
    let nchains = parseName(seg, segs, flexes)
    chains.push(nchains)

  })
  return _.flatten(chains)
} // end filterDictFlex


function selectLongest(chains) {
  let min = _.min(chains.map(chain => {  return chain.length } ) )
  log('MIN', min)
  let shortests = _.filter(chains, chain => { return chain.length == min })
  let max = _.max(shortests.map(chain => {  return _.sum(chain.map(segment => { return segment.seg.length }))/chain.length } ) )
  log('MAX', max)
  let lngsts = _.filter(shortests, chain => { return _.sum(chain.map(segment => { return segment.seg.length }))/chain.length >= max -1 })
  lngsts = _.sortBy(lngsts, chain => { return _.sum(chain.map(segment => { return segment.seg.length }))/chain.length }).reverse()
  return lngsts
}

function cleanStr(row) {
  let clean = row.trim()
  clean = clean.replace(/ᾰ/gi, 'α').replace(/ᾱ/gi, 'α').replace(/ῑ/gi, 'ι').replace(/ῐ/gi, 'ι').replace(/ῠ/gi, 'υ').replace(/ῡ/gi, 'υ')
  clean = clean.replace(/Ῐ/gi, 'Ι').replace(/Ῑ/gi, 'Ι')
  clean = clean.replace(/̆/gi, '')
  return clean
}
