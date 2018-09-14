import { log, voice, time } from './utils'
import _ from 'lodash'

import {comb, plain} from '../../../orthos'


let clog = console.log

// MAIN VERB
// verbs строятся по разным stems, т.е. один verb может порождать один chain по разным stems :
export function parseVerb (seg, segs, flexes) {
  // log('-----------------------> seg', seg)
  let vchains = []
  let last = _.last(segs)
  let penult = segs[segs.length-2]

  last.dicts.forEach(dict => { dict.dict = comb(dict.rdict) } )
  let lastverbs = _.filter(last.dicts, dict => { return dict.verb })
  let verbflexes = _.filter(flexes, flex => { return flex.verb })
  // let advflexes = _.filter(flexes, flex => { return flex.adv })
  // let nameflexes = _.filter(flexes, flex => { return flex.name })
  let partflexes = _.filter(flexes, flex => { return flex.part })
  // clog('FL', verbflexes)
  // clog('LASTVERBS', lastverbs.length)

  let vdicts = []
  let vfls = []
  let partdicts = []
  let partfls = []
  lastverbs.forEach(dict => {
    if (dict.plain == 'επο') log('NC-d ===========================>>>', dict)
    let fls = _.filter(verbflexes, flex => {
      if (dict.plain == 'επο' && flex.tense == 'mid.fut.part') log('NC-f ============', flex)

      if (dict.reg != flex.reg) return false
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
        // if (flex.skey && dict.skey != flex.skey) return false
        if (flex.pkey && !dict.pkey.includes(flex.pkey)) return false
        if (flex.ikey && dict.ikey != flex.ikey) return false
      }
      return true
    })

    let pfls = _.filter(partflexes, flex => {
      // if (dict.plain == 'αυδ' && flex.reg && flex.numcase == 'sg.gen') log('NC-p ==========', flex)
      // // return filterPart(dict, flex)

      // if (dict.pos != time(flex.tense)) return false

      // if (dict.reg) {
      //   if (!flex.reg) return false
      //   if (dict.rtype != flex.rtype) return false
      // } else {
      //   // type, time, voice, keys
      //   if (dict.type != flex.type) return false
      //   if (!dict.pkeys) return false
      //   let vc = voice(flex.tense)
      //   if (flex.part && dict.pkeys[vc] && !dict.pkeys[vc].includes(flex.pkey)) return false
      // }
      // return true
      return false
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

  // здесь verbs из разных rform (pres, fut, etc). Они дают корректные fls, но dicts должны дать один результат
  vdicts = uniqDict(vdicts)
  partdicts = uniqDict(partdicts)

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

  if (partdicts.length && partfls.length) {
    let cleanfls = partfls.map(flex => { return {tense: flex.tense, numcase: flex.numcase, gend: flex.gend} })
    // let cleanfls = partfls.map(flex => { return flex })
    let jsonfls = _.uniq(cleanfls.map(flex => { return JSON.stringify(flex) }) )
    cleanfls = jsonfls.map(flex => { return JSON.parse(flex) })
    let flsobj = {seg: seg, flexes: cleanfls}
    let pchain = cloneChain(segs, partdicts, null, flsobj)
    vchains.push(pchain)
  }

  return vchains
}

// NAME
export function parseName (seg, segs, flexes) {
  let nchains = []
  let last = _.last(segs)
  last.dicts.forEach(dict => { dict.dict = comb(dict.rdict) } )
  let lastnames = _.filter(last.dicts, dict => { return dict.name })
  let nameflexes = _.filter(flexes, flex => { return flex.name })
  let advflexes = _.filter(flexes, flex => { return flex.adv })


  // let gnames = _.filter(lastnames, dict => { return dict.gend })
  // let anames = _.filter(lastnames, dict => { return !dict.gend })
  // let ndicts = []
  // let nfls = []
  lastnames.forEach(dict => {
    if (dict.added || dict.sliced) return false
    // if (dict.plain == 'αγ') log('NAME-d ===========================>>>', dict)
    let fls = _.filter(nameflexes, flex => {
      // if (dict.plain == 'αγ' && flex.numcase == 'sg.gen') log('NAME-f =========================', flex)

      if (dict.gend && dict.gend != flex.gend) return false
      if (dict.ends && dict.ends != flex.ends) return false
      if (dict.ends && !dict.keys.includes(flex.key)) return false
      if (dict.gend && !dict.keys.map(key => { return key.split('-')[0] }).includes(flex.key.split('-')[0]) ) return false // for dicts from lsj
      return true
    })

    if (!fls.length) return
    dict.pos = 'name'
    // ndicts.push(dict)
    // nfls = fls // в names не так, как в глаголах - здесь разные db
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


function filterPart(dict, flex) {
  // pf is always irregular, even if dict is reg
  return true
  if (!dict.pf && dict.reg != flex.reg) return false
  if (dict.act && flex.acts && !flex.acts.includes(dict.act)) return false
  if (dict.mp && flex.mps && !flex.mps.includes(dict.mp)) return false

  return true
}

function filterVerb(dict, flex) {
  if (dict.rtype != flex.rtype) return false
  if (dict.reg && flex.reg) return true
  if (dict.reg) return false
  let vc = voice(flex.tense)
  // clog('F', flex)
  if (dict.vkeys[vc] && dict.vkeys[vc].includes(flex.vkey)) return true
  return false
}

function filterVerb_(dict, flex) {
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
    if (dict.sliced) return false
    // if (dict.passive && voice(flex.tense) != 'pas') return false // NB: проверить

    // if (dict.acts && flex.acts && _.intersection(dict.acts, flex.acts).length) return true
    // if (dict.mids && flex.mids && _.intersection(dict.mids, flex.mids).length) return true
    // if (dict.pas && flex.pas && _.intersection(dict.pas, flex.pas).length) return true

    // if (dict.acts && flex.act && dict.acts.includes(flex.act)) return true
    // if (dict.mps && flex.mp && dict.mps.includes(flex.mp)) return true
    if (dict.keys.includes(flex.key)) return true

    return false

    // NB: это проверить теперь, с авто-генерацией dict-flex
    // if (dict.passive && !dict.act && !dict.mid && flex.acts && !flex.acts.includes('ω')) return false
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
    // if (dict.weak) return false
    // if (dict.added) return false //
    // == IMPF ==

    if (dict.keys.includes(flex.key)) return true
    return false

  } else if (dict.pres) {
    // if (dict.weak) return false
    // if (dict.added) return false
    // if (dict.sliced) return false

    // weak - συγγράφω - impf: συνέγραφον - д.б. добавлено, пропускать нельзя


    if (flex.pres) {
      if (dict.sliced) return false // ἠγαθοποιοῦ - не должен найтись pres от ἀγαθο...
      if (dict.keys.includes(flex.key)) return true
    }
    else if (flex.pkeys) { // REG FUT,
      if (_.intersection(dict.keys, flex.pkeys ).length) return true
      // if (dict.keys.includes(flex.key)) return true
    }

    return false
  } else {
    return false
  }
  return true
}

function cloneChain(segs, dicts, pdict, fls) {
  let nchain = _.cloneDeep(segs)
  let nlast = _.last(nchain)
  nlast.dicts = dicts
  nchain.push(fls)
  return nchain
}
