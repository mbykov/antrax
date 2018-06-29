// import sum from './sum'
import _ from 'lodash'
import { log } from './lib/utils'
import { getTerms, getFlex, queryDBs, setDBs } from './lib/pouch'
import { segmenter } from './lib/segmenter'
import { accents as ac, tense, voice, mood, vowels, weaks, affixes, apiaugs, augs, eaug, augmods, apicompats, contrs } from './lib/utils'

process.EventEmitter = require('events').EventEmitter
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
  return getTerms(keys)
}

export function antrax (wordform) {
  if (!wordform) return new Promise(function() {})

  let clstr = cleanStr(wordform)
  let comb = orthos.toComb(clstr)
  let sgms = segmenter(comb)
  let clean = orthos.plain(comb)

  // segments for flexes:
  let lasts = _.uniq(sgms.map(sgm =>  { return sgm[sgm.length-1] }))
  // lasts = _.filter(lasts, last => { return last.length < 12 }) // max = 10 - ἀγγελ-θησοίμεσθα
  lasts.push(comb)
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
// TODO - affixes: impf - форма на die-, нужно добавить dia- - и все остальные приставки
function addedStems(wforms) {
  let plain, first, last, last2, added = []
  wforms.forEach(wf => {
    first = _.first(wf)
    last = _.last(wf)
    plain = orthos.plain(wf)
    let firsts = _.uniq([plain.slice(0,1), plain.slice(0,2), plain.slice(0,3), plain.slice(0,4), plain.slice(0,5)]) // aor. ind from aor others
    firsts = _.filter(firsts, first => { return first != plain })
    firsts.forEach(first => {
      if (!weaks[first]) return
      weaks[first].forEach(weak => {
        let add = [weak, plain.slice(first.length)].join('')
        added.push(add)
      })
    })

    if (!vowels.includes(first)) {
      let add = ['ε', plain].join('') // aor.sub, opt, impf for consonants
      added.push(add)
    }
  })
  return _.uniq(added)
}

function main(comb, plainsegs, sgms, pnonlasts, flexes, dicts) {
  dicts = _.filter(dicts, dict => { return !dict.indecl })
  log('dicts--->', dicts.length)

  let segdicts = distributeDicts(plainsegs, dicts)
  let chains = makeChains(sgms, segdicts, flexes)

  addDicts(chains, pnonlasts, segdicts)


  let fulls = fullChains(chains)
  log('chains: ', chains.length, 'fulls: ', fulls.length)
  if (fulls.length) chains = fulls
  else return []

  // соответствие dicts и flex, added dicts
  let cleans = filterDictFlex(comb, chains)
  let bests = selectLongest(cleans)
  log('main =>', fulls.length)

  bests.forEach(best => {
    // пока отключил для печати
    _.last(best).flexes.forEach(flex => { delete flex.dicts, delete flex.flex, delete flex.a, delete flex.h, delete flex.rgend, delete flex.rdicts }) // DELETES - здесь проходит
  })
  return bests
}


// предварительно распределяю dicts по всем plain-сегментам, включая добавочные :
function distributeDicts (plainsegs, dicts) {
  let segdicts = {}
  plainsegs.forEach((seg, idx) => {
    let sdicts = _.filter(dicts, dict => { return seg === dict.plain })
    segdicts[seg] = sdicts
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
    // clog('C', psegs)
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
    let stem, idxhi, aug, weak
    let penult = segs[segs.length-2]
    let seg = penult.seg
    seg = orthos.plain(seg)
    let first = _.first(seg)
    let sdicts = penult.dicts
    let firsts = _.uniq([seg.slice(0,1), seg.slice(0,2), seg.slice(0,3), seg.slice(0,4), seg.slice(0,5)])
    firsts = _.filter(firsts, first => { return first != seg })
    firsts.forEach(first => {
      if (!weaks[first]) return
      weaks[first].forEach(weak => {
        let added = [weak, seg.slice(first.length)].join('')
        let adicts = segdicts[added]
        adicts.forEach(adict => {
          if (!pnonlasts.includes(adict.plain)) adict.weak = true
        })
        if (adicts.length) sdicts.push(adicts)
      })
    })

    // ADDED
    if (!vowels.includes(first)) {
      let added = ['ε', seg].join('') // aor.sub, opt, impf from ind
      let adicts = segdicts[added]
      adicts.forEach(adict => {
        if (!pnonlasts.includes(adict.plain)) adict.added = true
      })
      if (adicts.length) sdicts.push(adicts)
    } else if (first == 'ε') { // pas.aor.sub - βλέπω  - ἔβλεψα - ἐβλεφθῶ - dict plain βλε
      if (seg.length < 2) return
      let added = seg.slice(1)
      let adicts = segdicts[added]
      adicts.forEach(adict => {
        if (!pnonlasts.includes(adict.plain)) adict.sliced = true
      })
      if (adicts.length) sdicts.push(adicts)
    }
    penult.dicts = _.uniq(_.compact(_.flatten(sdicts)))
  })
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

function filterDictFlex (comb, chains) {
  let clean = orthos.plain(comb)
  let cleans = []
  chains.forEach(segs => {
    let lastseg = _.last(segs)
    let flexes = lastseg.flexes
    let nameflexes = _.filter(flexes, flex => { return flex.name })
    let verbflexes = _.filter(flexes, flex => { return flex.verb })
    let advflexes = _.filter(flexes, flex => { return flex.adv })
    let partflexes = _.filter(flexes, flex => { return flex.part })
    segs = segs.slice(0, -1)

    let last = _.last(segs)
    if (!last) return
    let first = _.first(last.seg)

    let lastnames = _.filter(last.dicts, dict => { return dict.name })
    let lastverbs = _.filter(last.dicts, dict => { return dict.verb })

    // MAIN
    // VERB
    // verbs строятся по разным stems, т.е. один verb может порождать один chain по разным stems :
    let grverbs = _.groupBy(lastverbs, 'rdict')
    for (let grverb in grverbs) {
      let vgroup = grverbs[grverb]
      let vdicts = []
      let vfls = []
      let partdicts = []
      let partfls = []
      vgroup.forEach(dict => {
        if (dict.plain == 'αγαθοποι') log('NC-d ===========================>>>', dict)
        let fls = _.filter(verbflexes, flex => {
          if (dict.plain == 'εγεν' && flex.tense == 'mid.aor.sub') log('NC-f =========================', flex)
          // if (dict.reg)
          // if (!dict.reg) return filterVerb(dict, flex, first)
          return filterVerb(dict, flex)
        })
        let pfls = _.filter(partflexes, flex => {
          if (dict.plain == 'αγαθοποι' && flex.tense == 'act.pres.part') log('NC-p =========================', flex)
          return filterVerb(dict, flex)
        })
        if (fls.length) {
          vdicts.push(dict)
          vfls = vfls.concat(fls)
        }
        if (pfls.length) {
          partdicts.push(dict)
          partfls = partfls.concat(pfls)
        }
      })

      // существуют verbs из разных rform (pres, fut, etc). Они дают корректные fls, но dicts должны дать один результат. А разные DNs - разные результаты
      // uniq-verbs
      let udicts = []
      let ugrdbn = _.groupBy(vdicts, 'dname')
      for (let dname in ugrdbn) {
        let uverbs = ugrdbn[dname]
        let uvkeys = {}
        uverbs.forEach(uverb => {
          let uvkey = [uverb.rdict, uverb.trns.toString()].join('')
          if (uvkeys[uvkey]) return
          let udict = {verb: true, rdict: uverb.rdict, dname: uverb.dname, trns: uverb.trns, weight: uverb.weight}
          udicts.push(udict)
          uvkeys[uvkey] = true
        })
      }
      vdicts = udicts

      // r-dict νάω, νέομαι, νέω - могут иметь одинаковые формы - νέωμαι, νέομεν
      // объединяю vdicts в одно значение :
      if (vdicts.length && vfls.length) {
        let vflseg = _.uniq(vfls.map(flex => { return flex.flex }))
        if (vflseg.length > 1) throw new Error('VERB: FL LENGTH > 1')
        // HERE - просто lastseg !
        let cleanfls = vfls.map(flex => { return {tense: flex.tense, numper: flex.numper} })
        let jsonfls = _.uniq(cleanfls.map(flex => { return JSON.stringify(flex) }) )
        cleanfls = jsonfls.map(flex => { return JSON.parse(flex) })
        let flsobj = {seg: vflseg[0], flexes: cleanfls}
        let nchain = cloneChain(segs, vdicts, null, flsobj)
        cleans.push(nchain)
      }

      // participles уже всегда уникальны, dict.pres имеет окончания только flex.pres, т.е. udicts для parts не нужны
      if (partdicts.length && partfls.length) {
        let cleanfls = partfls.map(flex => { return {tense: flex.tense, numcase: flex.numcase, gend: flex.gend } })
        let flsobj = {seg: lastseg.seg, flexes: cleanfls}
        let nchain = cloneChain(segs, partdicts, null, flsobj)
        cleans.push(nchain)
      }
    } // end for-group

    // NAME
    // rdict - плох, потому что может иметь разные кодировки. Нужно перейти на .dict, а от .rdict вообще избавиться
    lastnames.forEach(lastname => { lastname.dict = orthos.toComb(lastname.rdict)})
    let grnames = _.groupBy(lastnames, 'dict')
    for (let grname in grnames) {
      let ngroup = grnames[grname]
      let ndicts = []
      let nfls = []
      ngroup.forEach(dict => {
        if (dict.plain == 'πατ') log('NC-d ===========================>>>', dict)
        let fls = []
        nameflexes.forEach(flex => {
          if (dict.plain == 'πατ' && flex.numcase == 'sg.nom') log('NAME-f =========================', flex)

          let gend, fdicts
          for (let rgend in flex.rgend) {
            let int = _.intersection(dict.dicts, flex.rgend[rgend])
            if (int.length) gend = rgend, fdicts = flex.rgend[rgend]
          }

          if (!fdicts) fdicts = flex.dicts // nouns
          let dint =_.intersection(dict.dicts, fdicts)
          if (!dint.length) return false

          // на dict.ad не влияют flex for-noun-only, только для noun, не имеющие gend
          if (dict.gend) {
            // if (!dict.gend.split(' ').includes(gend)) return false // убираю лишние gend
          } else {
            if (!gend) return false // у adj  род определяется из flex, gend обязан быть
            flex.gend = gend
          }

          if (flex.a && !dict.a) return false
          if (flex.h && !dict.h) return false
          fls.push(flex)
        })

        if (!fls.length) return
        ndicts.push(dict)
        nfls = fls // в names не так, как в глаголах - здесь разные db
      })

      if (ndicts.length && nfls.length) {
        let flsobj = {seg: lastseg.seg, flexes: nfls}
        let nchain = cloneChain(segs, ndicts, null, flsobj)
        cleans.push(nchain)
      }
    }

    // ADVERBS
    lastnames.forEach(dict => {
      let fls = []
      if (dict.plain == 'ααατ') log('ADV-d ===========================>>>', dict)
      advflexes.forEach(flex => {
        if (dict.plain == 'ααατ') log('ADV-f =========================', flex)

        let dint =_.intersection(dict.dicts, flex.dicts)
        if (!dint.length) return false

        // delete flex.dicts, delete flex.flex, delete flex.a, delete flex.h, delete flex.rgend
        let cflex = _.clone(flex)
        fls.push(cflex)
      })

      if (!fls.length) return

      let flsobj = {seg: lastseg.seg, flexes: fls}
      let nchain = cloneChain(segs, [dict], null, flsobj)
      // _.last(nchain).flexes.forEach(flex => { delete flex.dicts, delete flex.flex }) // DELETES - изменяет flexes ! нельзя !
      cleans.push(nchain)
    }) // adv

  })
  return cleans
} // end filterDictFlex

// VERB
function filterPart(dict, flex) {
}
function filterVerb(dict, flex) {
  if (dict.aor) {
    if (!flex.aor) return false
    // if (dict.added && mood(flex.tense) == 'ind') return false

    if (dict.voice == 'act' && voice(flex.tense) == 'mid') {}
    else if (dict.voice != voice(flex.tense)) return false

    if (dict.act && flex.acts && !flex.acts.includes(dict.act)) return false
    if (dict.mid && flex.mids && !flex.mids.includes(dict.mid)) return false
    if (dict.pas && flex.pass && !flex.pass.includes(dict.pas)) return false
    return true

  } else if (dict.fut) {
    if (!flex.fut) return false
    if (dict.weak) return false
    if (dict.added) return false
    if (dict.passive && voice(flex.tense) != 'pas') return false

    if (dict.act && flex.acts && !flex.acts.includes(dict.act)) return false
    if (dict.mid && flex.mids && !flex.mids.includes(dict.mid)) return false
    if (dict.pas && flex.pass && !flex.pass.includes(dict.pas)) return false

    if (dict.passive && !dict.act && !dict.mid && flex.acts && !flex.acts.includes('ω')) return false
    // δεδήσομαι - и все на ήσομαι - проходят. Тут либо все разбивать на мелкие группы, либо...
    // группа ω выбрана произвольно

  } else if (dict.pf) {
    if (!flex.pf) return false
    if (dict.weak) return false
    if (dict.added) return false

    if (dict.act && flex.acts && !flex.acts.includes(dict.act)) return false
    if (dict.mp && flex.mps && !flex.mps.includes(dict.mp)) return false
    if (dict.mpassive && !dict.act && flex.acts && !flex.acts.includes('κα')) return false
    if (!dict.mp && !flex.mps.includes('μαι') && !flex.acts.includes('κα')) return false
    // см. выше - fut
    // см ἀγήγοχα ,

  } else if (dict.ppf) {
    if (!flex.ppf) return false
    if (dict.weak) return false
    if (dict.added) return false

    if (dict.act && flex.acts && !flex.acts.includes(dict.act)) return false
    if (dict.mp && flex.mps && !flex.mps.includes(dict.mp)) return false

  } else if (dict.fpf) {
    if (!flex.fpf) return false
    if (dict.weak) return false
    if (dict.added) return false

    if (dict.act && flex.acts && !flex.acts.includes(dict.act)) return false
    if (dict.mp && flex.mps && !flex.mps.includes(dict.mp)) return false

  } else if (dict.impf) {
    if (!flex.impf) return false
    if (dict.weak) return false
    if (dict.added) return false
    // == IMPF ==

    if (!flex.dicts.includes(dict.dict)) return false
    if (dict.act && flex.acts && !flex.acts.includes(dict.act)) return false
    if (dict.mp && flex.mps && !flex.mps.includes(dict.mp)) return false

  } else if (dict.pres) {
    if (!flex.pres) return false
    if (dict.weak) return false
    if (dict.added) return false

    if (dict.act && flex.acts && !flex.acts.includes(dict.act)) return false
    if (dict.mp && flex.mps && !flex.mps.includes(dict.mp)) return false

    return true
  } else {
    return false
  }
  return true
}

function cloneChain(segs, dicts, pdict, fls) {
  let nchain = _.cloneDeep(segs)
  let nlast = _.last(nchain)
  nlast.dicts = dicts
  // nlast.d = dict.rform || dict.rdict // rdict для names - все это только для отладки, потом убрать
  nchain.push(fls)
  return nchain
}

// φύλακα => φυλακή, w=5, φύλαξ, w=4 ----> неаккуратно - минус один - нормально
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
