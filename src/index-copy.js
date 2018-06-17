// import sum from './sum'
import _ from 'lodash'
import {log} from './lib/utils'
import { getFlex, getDict, createDBs, queryDBs } from './lib/pouch'
import { segmenter } from './lib/segmenter'
import {accents as ac, tense, voice, mood, vowels, weaks, affixes, apiaugs, augs, eaug, augmods, apicompats, contrs} from './lib/utils'

const path = require('path')
const orthos = require('../../orthos') // publish - поправить версию

let clog = console.log
// let all = {startkey: 'α', endkey: 'ῳ'}

let wordform = process.argv.slice(2)[0] // || 'ἀργυρῷ' // false;
let env = process.env.NODE_ENV


/*
  getTerms: - вместо getFlex -> irregs -> etc
  фраза - getTerms - prons + irregs + specials ; irregs вынести в отдельные тесты
  запоминаю результат getTerms, span - мышь - показываю
  если нет в terms - getWF
  - antrax.js
  - run - index.js


*/




// console.time("queryTime");
// TODO: это вообще убрать, нужен runner
if (wordform !== '-g') { // yarn start wordform, i.e. ἀπετή
  antrax(wordform).then(chains => {
    // clog('END:', chains.length)
    // if (env !== 'test') console.log('CC:', chains)
    if (env !== 'test') chains.forEach(chain => { clog('C:', chain) , clog('F:', chain[chain.length-1].flexes) })
    // if (env !== 'test') chains.forEach(chain => { clog('C:', chain) , clog('D:', chain[chain.length-2].dict), clog('F:', chain[chain.length-1].flexes) })
    // console.timeEnd("queryTime");
  }).catch(function (err) {
    console.log('ANTRAX-ERR', err)
  })
}

// ADDED
// TODO - affixes: impf - форма на die-, нужно добавить dia- - и все остальные приставки
function addedStems(wforms) {
  let plain, first, last, last2, added = []
  wforms.forEach(wf => {
    first = _.first(wf)
    last = _.last(wf)
    plain = orthos.plain(wf)
    // let idxhi = plain.indexOf(ac.ypo)
    // let aug = (idxhi > -1) ? plain.slice(0,idxhi+1) : first
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

export function antrax (wordform) {
  // TODO: это отсюда вынести:
  // console.log('WF', wordform)
  if (!wordform) return new Promise(function() {})
  // if (wordform) wordform = wordform.trim()

  let clstr = cleanStr(wordform)
  let comb = orthos.toComb(clstr)
  log('COMB', comb)
  let sgms = segmenter(comb)
  log('SGMs:', sgms.length)
  let clean = orthos.plain(comb)
  log('CLEAN', clean)

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
  // let padded = _.uniq(_.compact(added.map(ad => { return orthos.plain(ad) }) ))
  log('Added:', added.toString())
  // let doubled = _.intersection(plainsegs, added)
  // log('Doubled:', doubled.toString())
  // let diffs = _.difference(plainsegs, added)
  // log('Diff:', diffs.toString())

  let plainsegs = (added.length) ? _.uniq(pnonlasts.concat(added)) : pnonlasts
  // if (added.length) plainsegs =  _.uniq(plainsegs.concat(added))
  log('Psegs:', plainsegs.toString())

  // cfg - как сделать ?
  // let dbnames = ['wiki', 'wspec', 'fgb']
  let dbnames = ['wktverb', 'wktname']
  let upath = '../'
  let dbs = createDBs(upath, dbnames)
  // clog('crDBs', dbs.length)

  return getFlex(lasts)
    .then(fls => {
      // log('PSEGS', plainsegs)
      let irregSegs = addIrregSegs(fls)
      // log('IR-SEGS', irregSegs)
      if (irregSegs) plainsegs = plainsegs.concat(irregSegs)
      return queryDBs(dbs, plainsegs)
        .then(rdocs => {
          // log('rowsDBs', rdocs.length)
          let dicts = _.flatten(rdocs)
          // if (irregSegs) return processIrreg(comb, dicts, fls)
          return main(comb, plainsegs, sgms, pnonlasts, fls, dicts)
        })
    })
} // export antrax

function addIrregSegs(fls) {
  let iFlexes = _.filter(fls, flex => { return flex.irreg })
  if (!iFlexes.length) return
  let irDSegs = _.uniq(iFlexes.map(flex => { return flex.dict }))
  // log('IrDSeg', irDSegs)
  return irDSegs
}

function processIrreg(comb, dicts, fls) {
  let irChains = []
  let irDicts = _.filter(dicts, dict => { return dict.irreg })
  log('IrDicts', irDicts.length)
  let iFlexes = _.filter(fls, flex => { return flex.irreg })

    irDicts.forEach(irDict => {
      let irFls = _.filter(iFlexes, flex => { return irDict.plain == flex.dict}) // в irregs - dict.plain (поиск-то по plain - не plain, а comb)
      let irChain = [{seg: comb, dicts: [irDict] }, {seg: null, flexes: irFls, type: 'irreg'}]
      irChains.push(irChain)
    })
    return irChains
}

function main(comb, plainsegs, sgms, pnonlasts, flexes, dicts) {
  // let clean = orthos.plain(comb)
  dicts = _.filter(dicts, dict => { return !dict.indecl })
  log('dicts--->', dicts.length)
  // let kdicts = _.filter(dicts, dict => { return dict.plain == 'εβ' })
  // clog('kdicts--->', kdicts)

  let segdicts = distributeDicts(plainsegs, dicts)
  // log('SEGDs--->', segdicts['χωρ'])
  let chains = makeChains(sgms, segdicts, flexes)
  // log('chains--->', chains)
  // пока убрал addDict, чтобы посмотреть, в каких случаях tenses ? или names ? оно нужно - понятно, например aor.sub без aug
  // то есть addDicts нужно даже до поиска по регулярным формам

  addDicts(chains, pnonlasts, segdicts)

  let irChains = processIrreg(comb, dicts, flexes)
  if (irChains.length) chains = chains.concat(irChains)


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
      if (idx < psegs.length-1) {
        pdicts = _.filter(pdicts, pdict => { return pdict.pref || pdict.name })
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
// добавляю к сегментам dicts, зависящие от положения сегмента
// как это будет работать с приставками, при изменении в середине слова???????????
// сейчас imperfect - в базе. Нужно попробовать решить стандартные без базы
//
function addDicts(chains, pnonlasts, segdicts) {
  chains.forEach(segs => {
    let stem, idxhi, aug, weak
    let penult = segs[segs.length-2]
    let seg = penult.seg
    seg = orthos.plain(seg)
    let first = _.first(seg)
    // if (seg.length < 2) return // временно, чтобы не загораживало // <============================ FIXME: (δοίην - уже не проходит, seg = δ)
    let sdicts = penult.dicts
    let firsts = _.uniq([seg.slice(0,1), seg.slice(0,2), seg.slice(0,3), seg.slice(0,4), seg.slice(0,5)])
    firsts = _.filter(firsts, first => { return first != seg })
    firsts.forEach(first => {
      if (!weaks[first]) return
      weaks[first].forEach(weak => {
        let added = [weak, seg.slice(first.length)].join('')
        let adicts = segdicts[added]
        // clog('----------', seg, weak, added, adicts)
        adicts.forEach(adict => {
          if (!pnonlasts.includes(adict.plain)) adict.weak = true
        })
        if (adicts.length) sdicts.push(adicts)
      })
    })

    // ADDED
    if (!vowels.includes(first)) {
      let added = ['ε', seg].join('') // aor.sub, opt, impf from ind
      // if (!doubled.includes(added)) return
      let adicts = segdicts[added]
      // if (seg == 'βαιν') clog('--->', seg, added, adicts)
      adicts.forEach(adict => {
        if (!pnonlasts.includes(adict.plain)) adict.added = true
      })
      if (adicts.length) sdicts.push(adicts)
    } else if (first == 'ε') { // pas.aor.sub - βλέπω  - ἔβλεψα - ἐβλεφθῶ - dict plain βλε
      if (seg.length < 2) return
      let added = seg.slice(1)
      let adicts = segdicts[added]
      // clog('----------', seg, added, adicts)
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
    // clog('chain--->', segs)

    let lastseg = _.last(segs)
    let flexes = lastseg.flexes
    let nameflexes = _.filter(flexes, flex => { return flex.name })
    let verbflexes = _.filter(flexes, flex => { return flex.verb })
    let advflexes = _.filter(flexes, flex => { return flex.adv })
    segs = segs.slice(0, -1)

    let last = _.last(segs)
    if (!last) return
    let first = _.first(last.seg)

    let lastnames = _.filter(last.dicts, dict => { return dict.name })
    let lastverbs = _.filter(last.dicts, dict => { return dict.verb })
    let lastparts = _.filter(last.dicts, dict => { return dict.part })
    // TMP ============================================================= TMP =========================
    lastnames = []

    // clog('lastverbs', lastverbs, segs)

    // появляются weaks - лишне в present  - ἀγαθοποιέετον-ἀγαθοποιέω дает лишний ἠγαθοποίεον в impf - отбрасываю - не уверен, всегда-ли это будет работать :
    // не уверен, правильный-ли это метод отбросить лишние решения, или их не должно буть в принципе здесь ?
    // или  их нужно отбрасывать ниже в циклах ?
    // let cl_lastverbs = _.filter(lastverbs, verb => { return !verb.weak })
    // if (cl_lastverbs.length) lastverbs = cl_lastverbs
    // нет, это не верно. Так я убиваю нужные weaks в aor, например ek- exe-
    // в презент weaks нужно и убирать в презент - но там они уже убраны, вот что плохо

    // MAIN
    // VERB
    // verbs строятся по разным stems, т.е. один verb может порождать один chain по разным stems :
    let grverbs = _.groupBy(lastverbs, 'rdict')
    // clog('grverbs:', grverbs)

    for (let grverb in grverbs) {
      let vgroup = grverbs[grverb]

      let vdicts = []
      let vfls = []
      vgroup.forEach(dict => {
        // if (dict.rdict != 'δέω') return
        // γελ - εγελ - εβαιν - εδ -
        if (dict.plain == 'εδ') log('NC-d ===========================>>>', dict)
        let fls = _.filter(verbflexes, flex => {
          if (dict.plain == 'εδ' && flex.tense == 'mp.impf.ind') log('NC-f =========================', flex)
          // if (dict.reg)
          if (!dict.reg) return filterVerb(dict, flex, first)
          return false
        }) // end flex-filter

        if (!fls.length) return
        vdicts.push(dict)
        vfls = vfls.concat(fls)
      })

      // if (grverb == 'δέω') clog('FLS ===========================>>>', vfls)

      // r-dict νάω, νέομαι, νέω - могут иметь одинаковые формы - νέωμαι, νέομεν
      // объединяю vdicts в одно значение :
      if (vdicts.length && vfls.length) {

        // clog('VDs', vdicts)
        let vflseg = _.uniq(vfls.map(flex => { return flex.flex }))
        if (vflseg.length > 1) throw new Error('VERB: FL LENGTH > 1')
        // HERE - просто lastseg !
        let cleanfls = vfls.map(flex => { return {tense: flex.tense, numper: flex.numper} })
        let jsonfls = _.uniq(cleanfls.map(flex => { return JSON.stringify(flex) }) )
        cleanfls = jsonfls.map(flex => { return JSON.parse(flex) })
        let flsobj = {seg: vflseg[0], flexes: cleanfls}

        // NB: грязно, переписать - после irregs
        let vrdicts = _.uniq(vdicts.map(vdict => { return vdict.rdict }))
        // if (vrdicts.length > 1) clog('VRD', vrdicts)
        if (vrdicts.length > 1) throw new Error('VERB: DICT LENGTH > 1')

        let vtrndict = _.find(vdicts, vdict => { return vdict.trns })
        if (!vtrndict) clog('NO TRNS', vdicts)
        if (!vtrndict) throw new Error('NO TRNS', vtrndict)
        let vtrns
        if (vtrndict) vtrns = vtrndict.trns
        let vdict = {verb: true, rdict: vrdicts[0], trns: vtrns}
        let nchain = cloneChain(segs, vdict, null, flsobj)
        cleans.push(nchain)
      }

    } // end for-group

    // NAME
    lastnames.forEach(dict => {
      let fls = []
      if (dict.plain == 'αβουλι') log('NC-d ===========================>>>', dict)
      nameflexes.forEach(flex => {
        if (!flex.name) return false
        if (dict.plain == 'αβουλι' && flex.numcase == 'sg.nom') log('NAME-f =========================', flex)

        let gend, fdicts
        for (let rgend in flex.rgend) {
          let int = _.intersection(dict.dicts, flex.rgend[rgend])
          if (int.length) gend = rgend, fdicts = flex.rgend[rgend]
        }

        if (!fdicts) fdicts = flex.dicts // nouns
        let dint =_.intersection(dict.dicts, fdicts)
        if (dict.plain == 'αβουλι') log('ds ====', dict.dicts, 'fs', fdicts, 'dint', dint)
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
        // if (dict.ah && !flex.ah) return false

        // delete flex.dicts, delete flex.flex, delete flex.a, delete flex.h, delete flex.rgend
        let cflex = _.clone(flex)
        fls.push(cflex)
      })

      if (!fls.length) return

      let flsobj = {seg: lastseg.seg, flexes: fls}
      let nchain = cloneChain(segs, dict, null, flsobj)
      // _.last(nchain).flexes.forEach(flex => { delete flex.dicts, delete flex.flex }) // DELETES - изменяет flexes ! нельзя !
      cleans.push(nchain)
    }) // names

    // ADVERBS
    lastnames.forEach(dict => {
      let fls = []
      if (dict.plain == 'ακ') log('ADV-d ===========================>>>', dict)
      advflexes.forEach(flex => {
        if (dict.plain == 'ακ') log('ADV-f =========================', flex)

        let dint =_.intersection(dict.dicts, flex.dicts)
        // if (dict.plain == 'αβουλι') log('ds ====', dict.dicts, 'fs', flex.dicts, 'dint', dint)
        if (!dint.length) return false

        // delete flex.dicts, delete flex.flex, delete flex.a, delete flex.h, delete flex.rgend
        let cflex = _.clone(flex)
        fls.push(cflex)
      })

      if (!fls.length) return

      let flsobj = {seg: lastseg.seg, flexes: fls}
      let nchain = cloneChain(segs, dict, null, flsobj)
      // _.last(nchain).flexes.forEach(flex => { delete flex.dicts, delete flex.flex }) // DELETES - изменяет flexes ! нельзя !
      cleans.push(nchain)
    }) // adv

  })
  return cleans
} // end filterDictFlex

// VERB
function filterVerb(dict, flex, first) {
  if (dict.aor) {
    // if (tense(flex.tense) != 'aor') return false
    // if (dict.mid && voice(flex.tense) != 'mid') return false
    // else if (dict.pas && voice(flex.tense) != 'pas') return false
    if (!flex.aor) return false
    if (dict.added && mood(flex.tense) != 'ind') return false

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
    // if (dict.mpassive && !dict.act && flex.acts && !flex.acts.includes('κα')) return false
    // if (!dict.mp && !flex.mps.includes('μαι') && !flex.acts.includes('κα')) return false
    // см. выше - fut
    // см ἀγήγοχα ,

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

    // == PRES ==
    // if (dict.plain == 'γελ') {
    //   clog('d', dict)
    //   clog('f', flex)
    // }

    // непонятно, как сквозь этот фильтр проходит aor ? γείνῃ ?
    if (dict.voice == 'mp' && dict.voice != voice(flex.tense)) return false

    // if (dict.act && !flex.acts) return false
    // else if (dict.act && !flex.acts.includes(dict.act)) return false
    // в dict я ищу act, хотя flex - м.б. mp - т.е. dict не имеет act, но flex при этом - act, всякие omai
    if (dict.act) {
      if (!flex.acts) return false
      if ( !flex.acts.includes(dict.act)) return false
      if (dict.mp && !flex.mps) return false
      if (dict.mp && !flex.mps.includes(dict.mp)) return false
    }

    if (dict.mp) {
      if (!flex.mps) return false
      if ( !flex.mps.includes(dict.mp)) return false
      if (!voice(flex.tense) == 'mp') return false
      if (dict.act && !flex.acts) return false
      if (dict.act && !flex.acts.includes(dict.act)) return false
      if (!dict.act && flex.acts && flex.acts.includes('ωμι')) return false // dict - only mp=ομαι ;  can be ω-ομαι (true) and ωμι-ομαι (false)
    }
    return true
  } else {
    return false
  }
  return true
}

function cloneChain(segs, dict, pdict, fls) {
  let nchain = _.cloneDeep(segs)
  let nlast = _.last(nchain)
  nlast.dict = dict
  delete nlast.dicts
  // dicts в остальных цепочках. В penult, т.е. главной, всегда один, по способу создания цепочки
  // nlast.dicts = [dict]
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
  // >>>>>>>>>>>>>>>> вот это я не понимаю, нужен пример
  let lngsts = _.filter(shortests, chain => { return _.sum(chain.map(segment => { return segment.seg.length }))/chain.length >= max -1 })
  lngsts = _.sortBy(lngsts, chain => { return _.sum(chain.map(segment => { return segment.seg.length }))/chain.length }).reverse()
  // return chains
  return lngsts
}

function cleanStr(row) {
  let clean = row.trim()
  // clean = clean.replace(/\.$/, '')
  clean = clean.replace(/ᾰ/gi, 'α').replace(/ᾱ/gi, 'α').replace(/ῑ/gi, 'ι').replace(/ῐ/gi, 'ι').replace(/ῠ/gi, 'υ').replace(/ῡ/gi, 'υ')
  clean = clean.replace(/Ῐ/gi, 'Ι').replace(/Ῑ/gi, 'Ι')
  clean = clean.replace(/̆/gi, '')
  return clean
}




// ========================================= OLD ==============================


// OLD VERSION
function filterSgms_ (wordform, sgms, dicts, allflexes) {
  let chains = []
  sgms.forEach(segs => {
    // log('segs--->', segs)
    let lastseg = _.last(segs)
    let flexes = _.filter(allflexes, flex => { return flex.flex === lastseg} )
    if (!flexes.length) return
    segs = segs.slice(0, -1)
    let chain = segs2chain(segs, dicts)

    let last = _.last(chain)
    if (!last) return
    if (last.weight < 0) return
    let penult = chain[chain.length-2]
    // console.log('P', penult)

    let lastnames = _.filter(last.dicts, dict => { return dict.pos === 'name' })
    let lastverbs = _.filter(last.dicts, dict => { return dict.pos === 'verb' })
    let lastparts = _.filter(last.dicts, dict => { return dict.pos === 'part' })

    // группирую по .dict, чтобы выбрать простейшие (.api) - для каждого dict
    let gverbs = []
    // let gdicts = _.groupBy(last.dicts, dict => { return dict.dict })
    // // log('==================GD', gdicts)
    // for (let gdict in gdicts) {
    //   let dicts = gdicts[gdict]
    //   let nregs = _.filter(dicts, dict => { return !dict.reg })
    //   let regs = _.filter(dicts, dict => { return dict.reg })
    //   if (nregs.length) gverbs.push(nregs)
    //   else if (regs.length) {
    //     let apis = _.filter(regs, dict => { return (dict.dep) ? dict.var == 'mp.pres.ind' : dict.var == 'act.pres.ind' } )
    //     if (apis.length) gverbs.push(apis)
    //     else gverbs.push(regs)
    //   }
    // }
    // gverbs = _.flatten(gverbs)
    gverbs = lastverbs

    if (!gverbs) throw new Error('no API')
    // clog('GVERBS', gverbs, segs)

    // augmods = ['act.impf.ind', 'mp.impf.ind', 'act.aor.ind', 'mid.aor.ind', 'act.ppf.ind', 'mp.ppf.ind', 'pass.aor.ind']
    // apicompats = ['act.pres.ind', 'act.fut.ind', 'act.impf.ind','mp.pres.ind','mp.impf.ind','act.pres.sub','mp.pres.sub','mp.pres.opt', 'act.pres.opt', 'act.pres.imp', 'mp.pres.imp', 'mid.fut.ind', 'act.fut.opt', 'mid.fut.opt', 'act.aor.ind', 'mid.aor.ind', 'act.aor.sub', 'mid.aor.sub', 'act.aor.opt', 'mid.aor.opt', 'act.aor.imp', 'mid.aor.imp', 'pass.aor.ind', 'pass.fut.ind', 'pass.aor.sub', '', '', '']

    gverbs.forEach(dict => {
      if (dict.plain == 'κεχρη') log('NC-d ==============================', dict)
      let paug

      let fls = _.filter(flexes, flex => {
        // if (dict.plain == 'δεδε' && flex.var == 'act.ppf.ind') log('NC-f ===============', flex)

        if (!dict.reg) {
          if (flex.reg) return false
          // if (dict.plain == 'δεδε' && flex.var == 'act.ppf.ind') log('NC-f ===============', flex)

          // PPF HERE
          if (tense(flex.var) !== 'ppf') {
            if (tense(dict.var) !== tense(flex.var)) return false
          } else {
            if (tense(dict.var) !== 'pf')  return false
          }
          // я оставляю аугмент E для ppf как ante-segent, он есть в словаре - но не проверяю и не конструирую здесь. Нелогично

          // λυθῶ - pas.aor.sub определяется и из act.aor.ind и из pas.aor.ind, одно нужно отбросить
          if (tense(dict.var) == 'aor') {
            if (voice(flex.var) === 'pas' && voice(dict.var) !== 'pas') return false
            if (voice(flex.var) === 'act' && voice(dict.var) !== 'act') return false
            if (voice(flex.var) === 'mid' && voice(dict.var) !== 'act') return false
          }
          // для fut - это отрезает pas.fut от форм из act.fut, т.е. всех

          if (dict.contr && dict.contr != flex.contr && flex.contr != 'any')  return false

          if (dict.dep && !flex.dep) return false // - нельзя - pas.aor.ind - одинаковые для dep и не dep, не хочется вводить, если не найду пример, зачем
          let flexdict = (dict.dep) ? flex.dep : flex.dict
          if (flexdict !== dict.flex) return false

          // либо прописывать все соответствия - mute-mute, liquid-liquid, etc, либо return true :
          return true
        } else {
          if (!flex.reg) return false
          if (dict.contr) {
            if (flex.contr == 'any') return true
            else if (dict.contr !== flex.contr) return false
          }
          if (dict.dep && !flex.dep) return false
          let flexdict = (dict.dep) ? flex.dep : flex.dict
          if (flexdict !== dict.flex) return false
          // if (dict.plain == 'λυ' && flex.var == 'act.ppf.ind') log('NC-f ===============', flex)
          // return true
        }
        return true
      }) // end filter


      if (!fls.length) return
      let nchain = cloneChain(chain, dict, paug, fls)
      chains.push(nchain)

      if (dict.plain == 'κεχρη') log('FLs', dict.raw, fls.length, nchain)
      // clog('HERE', dict.raw, segs)

      // == PERFECT ==
      if (dict.reg && dict.vmorphs) {
        if (dict.vmorphs.includes('act.pf.ind')) return // забираем результат из списка
        let rpfls = _.filter(fls, fl => {  return tense(fl.var) === 'pf' })
        let rppfls = _.filter(fls, fl => {  return tense(fl.var) === 'ppf' })
        if (!rpfls.length && ! rppfls.length) return

        let penult = segs[segs.length-2] // segs have no flexes, so - 2
        if (!penult) return
        // if (dict.plain == 'δεδε') log('NC-fls ===============', penult)
        let pplain = orthos.plain(penult)
        if (pplain.length != 2) return
        if (pplain[1] !== 'ε') return
        let seg = segs[segs.length-1]
        let pseg = [penult, seg].join('')
        let psegplain = orthos.plain(pseg)
        let redupseg = {seg: pseg, dicts: [dict], weight: psegplain.length, d: dict.raw}
        let rchain = chain.slice(0, -2)
        rchain.push(redupseg)

        if (rpfls.length) { // .pf
          let crchain = _.clone(rchain)
          crchain.push(rpfls)
          chains.push(crchain)
        }
        if (rppfls.length)  { // .ppf
          let antepenult = segs[segs.length-3] // segs have no flexes, so - 3
          if (!antepenult) return
          let applain = orthos.plain(antepenult)
          if (applain !== 'ε') return // augment E
          let apseg = [applain, penult, seg].join('')
          let apsegplain = orthos.plain(apseg)
          let aredupseg = {seg: apseg, dicts: [dict], weight: apsegplain.length, d: dict.raw}
          let rchain = chain.slice(0, -3)
          rchain.push(aredupseg)
          let crchain = _.clone(rchain)
          crchain.push(rppfls)
          chains.push(crchain)
          // if (dict.plain == 'λυ') log('NC-fls ===============', segs, 'ant', antepenult, crchain)
        }
      }
    })
    // end gverbs

    lastnames.forEach(dict => {
      let fls = _.filter(flexes, flex => { return flex.dict === dict.flex && flex.var.split(' ').includes(dict.var) })
      if (!fls.length) return
      let nchain = cloneChain(chain, dict, null, fls)
      // chains.push(nchain)
    })

  })
  return selectLongest(chains)
} // OLD VERSION

function selectLongest_(chains) {
  let fulls = _.filter(chains, chain => { return (chain.map(seg => { return seg.weight }).includes(-1) ) ? false : true })
  if (fulls.length) chains = fulls
  // else clog('= no fulls ='); return []

  // в тестах д.б. всегда один результат и fls. Потом отбросить лишние аккуратно - <<============== FIXME:
  chains = _.filter(chains, chain => { return chain.length == 2 })

  let min = _.min(chains.map(chain => {  return chain.length } ) )
  log('MIN', min)
  let shortests = _.filter(chains, chain => { return chain.length == min })
  let max = _.max(shortests.map(chain => {  return _.sum(chain.map(seg => { return seg.weight }))/chain.length } ) )
  log('MAX', max)
  let lngsts = _.filter(shortests, chain => { return _.sum(chain.map(seg => { return seg.weight }))/chain.length >= max -1 })
  lngsts = _.sortBy(lngsts, chain => { return _.sum(chain.map(seg => { return seg.weight }))/chain.length }).reverse()
  // return chains
  return lngsts
}


function addDicts_(chains, segdicts) {
  chains.forEach(segs => {
    let first, last, last2, stem, idxhi, aug, auged
    segs.slice(0,-1).forEach((segment, idx) => {
      // log('add-seg=>', segment, segment.seg == 'ἐ')
      let seg = segment.seg
      seg = orthos.plain(seg)
      let sdicts = segment.dicts
      if (!sdicts) throw new Error('NO SDICTS FOR SEG') // FIXME: убрать =====================================
      last = _.last(seg)
      last2 = seg.slice(-2)

      // log('seg-------> ', seg, last, last2)
      // εἰμί - sg.3 - ἐστί - aspiration should be removed
      // if (seg == 'ἐ' || seg == 'ἰ') {
      //   stem = 'ε'
      //   if (!segdicts[stem]) throw new Error('NO SEGDICTS')
      //   sdicts.push(segdicts[stem])
      // }


      first = _.first(seg)
      segment.dicts = _.flatten(sdicts)
    })
  })
}
