//
import _ from 'lodash'
import { log } from './lib/utils'
import { getTerm, getFlex, queryDBs, setDBs } from './lib/pouch'
import { segmenter } from './lib/segmenter'
import { parseVerb, parseName } from './lib/mutables'
import { vowels, strongs } from './lib/utils'
import { strong2weak } from './lib/augments'
import util from 'util'
import {comb, plain} from '../../orthos'

const path = require('path')
let clog = console.log

let wordform = process.argv.slice(2)[0] // || 'ἀργυρῷ' // false;
let env = process.env.NODE_ENV

export function enableDBs (upath, apath) {
  setDBs(upath, apath)
}

// export function clause (wfs) {
//     let keys = wfs.map(wf => comb(wf))
//     return getTerms(keys)
// }

export function antrax (wf) {

  let clwf = cleanStr(wf)
  let cwf = comb(clwf)

  let sgms = segmenter(cwf)
  // segments for flexes:
  let lasts = _.uniq(sgms.map(sgm =>  { return sgm[sgm.length-1] }))
  log('lasts', lasts)
  // segments for dicts:
  let nonlasts = _.uniq(_.flatten(sgms.map(sgm =>  { return sgm.slice(0, -1) }) ))
  let pnonlasts = _.uniq(_.compact(nonlasts.map(nonlast => { return plain(nonlast) }) ))
  log('NONlast:', pnonlasts.toString())

  let added = addedStems(pnonlasts)
  log('Added:', added.toString())
  // added = []  // added необходимо добавлять, потому что reg impf, aor - в словаре только слабая форма
  // а вот non-reg из added можно убрать? то есть достройка только до splain, strong-plain ?

  let plainsegs = (added.length) ? _.uniq(pnonlasts.concat(added)) : pnonlasts
  log('Psegs:', plainsegs.toString())

  return Promise.all([
    getTerm(cwf),
    queryDBs(plainsegs),
    getFlex(lasts)
  ]).then(function (res) {
    let terms = _.flatten(res[0])
    let dicts = _.flatten(res[1])
    dicts = _.filter(dicts, dict => { return !dict.term })
    let flexes = _.flatten(res[2])
    let muts = main(cwf, plainsegs, sgms, pnonlasts, flexes, dicts)
    return _.compact(terms.concat(muts))
  })
}

// ADDED
function addedStems(wforms) {
  let wplain, first, added = []
  wforms.forEach(wf => {
    first = _.first(wf)
    wplain = plain(wf)
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

    let weaks = strong2weak[first]
    if (!vowels.includes(first)) {
      let add = ['ε', wplain].join('') // aor.sub, opt, impf for consonants
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

function main(cwf, plainsegs, sgms, pnonlasts, flexes, dicts) {
  dicts = _.filter(dicts, dict => { return !dict.indecl })
  // dicts = _.filter(dicts, dict => { return dict.rdict })
  log('dicts--->', dicts.length)
  let dplains = _.uniq(dicts.map(dict => { return dict.plain}))
  log('dplains---->', dplains.toString())
  let ndplains = _.filter(dicts, dict => { return !dict.plain })
  log('ndplains---->', ndplains.length)
  let kdicts = _.filter(dicts, dict => { return dict.plain == 'βουλ'})
  log('kdicts---->', kdicts.length)
  log('flexes--->', flexes.length)
  let kflexes = _.filter(flexes, fl => { return fl.flex == 'ον'})
  kflexes = _.filter(kflexes, fl => { return fl.verb })
  log('kflexes--->', kflexes.length)

  let segdicts = distributeDicts(plainsegs, dicts)
  // log('SGD', segdicts['αγαθοποι'])
  let chains = makeChains(sgms, segdicts, flexes)

  chains = _.filter(chains, chain => { return chain.length == 2 }) // NB: <<<<<<<<<<<<<<<<<<<<<========================
  log('total chains', chains.length)

  // неясно, compound до addDict или после
  addDicts(chains, pnonlasts, segdicts)
  // неясно вообще с addDicts, оставить до aor

  // compound(chains)

  let fulls = fullChains(chains)
  log('chains: ', chains.length, 'fulls: ', fulls.length)
  if (fulls.length) chains = fulls
  else return []

  // соответствие dicts и flex, added dicts
  let dfchains = filterDictFlex(chains)

  // нужно, чтобы лишних в aors не было, но пока: (κτήσησθε)
  let cleans = []
  let fkeys = {}
  dfchains.forEach(chain => {
    let penult = chain[chain.length-2]
    let ult = chain[chain.length-1]
    let fkey = [JSON.stringify(penult.dicts), JSON.stringify(ult.flexes)].join('-')
    if (fkeys[fkey]) return
    cleans.push(chain)
    fkeys[fkey] = true
  })

  let bests = selectLongest(cleans)
  log('bests =>', bests.length)

  bests.forEach(segs => {
    if (segs.length == 4) {
      segs.forEach(segment => {
        if (segment.seg == 'ο') segment.dicts = [{spec: true, rdict: 'ο', trns: ['o-connector'] }]
      })
    }
  })

  if (!bests.length) return
  // return {form: cwf, chains: bests}
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
      let pseg = plain(seg)
      let pdicts = segdicts[pseg]
      // let prfdicts
      // if (idx < psegs.length-1) {
      //   pdicts = _.filter(pdicts, pdict => { return pdict.pref || pdict.name })
      //   prfdicts = _.filter(pdicts, pdict => { return pdict.pref })
      //   if (prfdicts.length) pdicts = prfdicts
      // }
      let oseg = {seg: seg, dicts: pdicts }
      chain.push(oseg)
    })

    // FLEXES поправить
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
    seg = plain(seg)
    let first = _.first(seg)
    // if (penult.dicts.length) return // уже есть значение, добавлять не нужно - нет, так нельзя, ἦγον имеет ненужный ηγ и не пустит
    let sdicts = _.clone(penult.dicts)
    // let firsts = _.uniq([seg.slice(0,1), seg.slice(0,2), seg.slice(0,3), seg.slice(0,4), seg.slice(0,5)])
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

    let weaks = strong2weak[first]
    if (!vowels.includes(first)) {
      let added = ['ε', seg].join('') // aor.sub, opt, impf from ind
      addDictCarefully(pnonlasts, segdicts, sdicts, added, 'added')
    } else if (first == 'ε') { // pas.aor.sub - βλέπω  - ἔβλεψα - ἐβλεφθῶ - dict plain βλε
      if (seg.length < 2) return
      let added = seg.slice(1)
      addDictCarefully(pnonlasts, segdicts, sdicts, added, 'sliced')
    } else if (first == 'η') { // mp.impf.ind - ἠβουλόμην, ἐβουλόμην
      if (seg.length < 2) return
      let added = seg.slice(1)
      addDictCarefully(pnonlasts, segdicts, sdicts, added, 'sliced')
    }
    if (weaks) {
      weaks.forEach(weak => {
        let stem = seg.slice(1)
        let added = [weak, stem].join('')
        addDictCarefully(pnonlasts, segdicts, sdicts, added, 'sliced')
      })
    }
    penult.dicts = _.compact(_.flatten(sdicts))
  })
}

function addDictCarefully(pnonlasts, segdicts, sdicts, added, mark) {
  let adicts = segdicts[added]
  // log('added: --------------------------------------->', added, adicts.length)
  adicts = _.filter(adicts, dict => { return dict.verb })
  if (!adicts || !adicts.length) return
  adicts.forEach(adict => {
    // случай, когда plain включен в исходные pnonlasts, но не в данной chain - ἐδείκνυν, plain δεικνυ в 3-chain
    // if (!pnonlasts.includes(adict.plain)) adict[mark] = true
    // но без проверки на pnonlasts.includes отвалится что-то важное потом
    adict[mark] = true
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

function filterDictFlex (rchains) {
  let chains = []
  rchains.forEach(rchain => {
    let lastseg = _.last(rchain)
    let seg = lastseg.seg
    let flexes = lastseg.flexes
    let segs = rchain.slice(0, -1)
    if (!segs.length) return

    let vchains = parseVerb(seg, segs, flexes)
    chains.push(vchains)
    let nchains = parseName(seg, segs, flexes)
    chains.push(nchains)
  })
  return _.flatten(chains)
}


function compound(chains) {
  let cmpds = []
  chains.forEach(segs => {
    // let ult = segs[segs.length-1]
    let penult = segs[segs.length-2]
    let antepen = segs[segs.length-3]
    // если penult = suffix, а antepen - verb // NB - заменить после specs
    let pensuffs = _.filter(penult.dicts, dict => { return dict.plain == 'ε' })
    let anteverbs = _.filter(antepen.dicts, dict => { return dict.verb })
    let suff = {spec: true, rdict: 'ο', dict: 'ο', trns: ['e-suffix'] }
    log(111, antepen.seg, penult.seg, pensuffs.length, anteverbs.length)
    if (penult && antepen && pensuffs.length && anteverbs.length) penult.dicts = [suff], antepen.dicts = anteverbs
    // penult.dicts = [suff], antepen.dicts = anteverbs
  })
}

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
