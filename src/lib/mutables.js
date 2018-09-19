import { log, voice, time } from './utils'
import _ from 'lodash'

// import {comb, plain} from '../../../orthos'

let clog = console.log

// MAIN VERB
// verbs строятся по разным stems, т.е. один verb может порождать один chain по разным stems :
export function parseVerb (seg, segs, flexes) {
  let vchains = []
  let last = _.last(segs)
  let penult = segs[segs.length-2]

  // last.dicts.forEach(dict => { dict.dict = comb(dict.rdict) } )
  let lastverbs = _.filter(last.dicts, dict => { return dict.verb })
  let verbflexes = _.filter(flexes, flex => { return flex.verb })
  let partflexes = _.filter(flexes, flex => { return flex.part })

  let vdicts = []
  let vfls = []
  let partdicts = []
  let partfls = []
  lastverbs.forEach(dict => {
    if (dict.plain == 'εχρα') log('NC-d ===========================>>>', dict)
    let fls = _.filter(verbflexes, flex => {
      if (dict.plain == 'εχρα' && flex.tense == 'act.impf.ind') log('NC-f ============', flex)

      if (dict.reg != flex.reg) return false
      if (dict.sliced && flex.part) return false // причастия не имеют augs ἄγω - ἦγον
      if (dict.reg) {
        if (flex.vkey && !dict.vkeys[flex.time]) return false
        else if (flex.vkey && !dict.vkeys[flex.time].includes(flex.vkey)) return false
        if (flex.pkey && !dict.pkeys[flex.time]) return false
        else if (flex.pkey && !dict.pkeys[flex.time].includes(flex.pkey)) return false
        if (flex.ikey && !dict.ikeys[flex.time]) return false
        else if (flex.ikey && !dict.ikeys[flex.time].includes(flex.ikey)) return false
      } else {
        if (dict.time != flex.time) return false
        if (flex.vkey && dict.vkey != flex.vkey) return false
        if (flex.pkey && dict.pkey != flex.pkey) return false
        if (flex.ikey && dict.ikey != flex.ikey) return false
      }
      return true
    })

    if (fls.length) {
      vdicts.push(dict)
      vfls = vfls.concat(fls)
    }
  })

  // здесь verbs из разных rform (pres, fut, etc). Они дают корректные fls, но dicts должны дать один результат
  vdicts = uniqDict(vdicts)
  // partdicts = uniqDict(partdicts)

  if (vdicts.length && vfls.length) {
    // let cleanfls = vfls.map(flex => { return {tense: flex.tense, numper: flex.numper} })
    let cleanfls = vfls.map(flex => {
      let cflex
      if (flex.numcase) cflex = {tense: flex.tense, numcase: flex.numcase, gend: flex.gend}
      else cflex = {tense: flex.tense, numper: flex.numper}
      return cflex
    })
    let jsonfls = _.uniq(cleanfls.map(flex => { return JSON.stringify(flex) }) )
    cleanfls = jsonfls.map(flex => { return JSON.parse(flex) })
    let flsobj = {seg: seg, flexes: cleanfls}
    let vchain = cloneChain(segs, vdicts, null, flsobj)
    vchains.push(vchain)
  }

  return vchains
}

// NAME
export function parseName (seg, segs, flexes) {
  let nchains = []
  let last = _.last(segs)
  // last.dicts.forEach(dict => { dict.dict = comb(dict.rdict) } )
  let lastnames = _.filter(last.dicts, dict => { return dict.name })
  let nameflexes = _.filter(flexes, flex => { return flex.name })
  let advflexes = _.filter(flexes, flex => { return flex.adv })

  lastnames.forEach(dict => {
    if (dict.added || dict.sliced) return false
    if (dict.plain == 'αρκετ') log('NAME-d ===========================>>>', dict)
    let fls = _.filter(nameflexes, flex => {
      if (dict.plain == 'αρκετ' && flex.numcase == 'sg.nom') log('NAME-f ==========', flex)

      if (dict.gend && dict.gend != flex.gend) return false
      if (dict.ends && dict.ends != flex.ends) return false
      if (dict.gend && !dict.keys.map(key => { return key.split('-')[0] }).includes(flex.key.split('-')[0]) ) return false // for dicts from lsj
      // if (dict.ends && !dict.keys.includes(flex.key)) return false
      if (!dict.gend && !dict.keys.map(key => { return key.split('-')[0] }).includes(flex.key.split('-')[0]) ) return false // for adj dicts from lsj
      return true
    })

    if (!fls.length) return
    dict.pos = 'name'
    let cleanfls = fls.map(flex => { return {numcase: flex.numcase, gend: flex.gend} })
    let jsonfls = _.uniq(cleanfls.map(flex => { return JSON.stringify(flex) }) )
    cleanfls = jsonfls.map(flex => { return JSON.parse(flex) })
    let flsobj = {seg: seg, flexes: cleanfls}
    let nchain = cloneChain(segs, [dict], null, flsobj)
    nchains.push(nchain)
  })


  // ADVERBS
  lastnames.forEach(rdict => {
    let dict = _.clone(rdict)
    if (dict.plain == 'αργυρ') log('ADV-d ===========================>>>', dict)
    let fls = _.filter(advflexes, flex => {
      if (dict.plain == 'αργυρ') log('ADV-f =========================', flex)
      if (!dict.keys.includes(flex.key)) return false
      return true
    })

    if (!fls.length) return
    dict.pos = 'adv'

    let cleanfls = fls.map(flex => { return {term: flex.term, degree: flex.degree} })
    let jsonfls = _.uniq(cleanfls.map(flex => { return JSON.stringify(flex) }) )
    cleanfls = jsonfls.map(flex => { return JSON.parse(flex) })
    let flsobj = {seg: seg, flexes: cleanfls}
    let nchain = cloneChain(segs, [dict], null, flsobj)
    nchains.push(nchain)
  }) // adv
  return nchains
}

function uniqDict(dicts) {
  let udicts = []
  let uvkeys = {}
  dicts.forEach(dict => {
    // NB: нужна санитанизация dict - иначе если нет trns, будет ошибка
    if (!dict.trns) dict.trns = 'no trns:' + dict.rdict
    let uvkey = [dict.rdict, dict.dbname, dict.trns.toString()].join('')
    if (uvkeys[uvkey]) return
    let udict = {pos: 'verb', time: dict.time, rdict: dict.rdict, plain: dict.plain, dname: dict.dname, trns: dict.trns, weight: dict.weight}
    // let udict = dict
    if (dict.reg) udict.reg = true
    udicts.push(udict)
    uvkeys[uvkey] = true
  })
  return udicts
}

function cloneChain(segs, dicts, pdict, fls) {
  let nchain = _.cloneDeep(segs)
  let nlast = _.last(nchain)
  nlast.dicts = dicts
  nchain.push(fls)
  return nchain
}
