import { log, voice } from './utils'
import _ from 'lodash'

// const orthos = require('../../orthos')
const orthos = require('orthos')

let clog = console.log

// MAIN VERB
// verbs строятся по разным stems, т.е. один verb может порождать один chain по разным stems :
export function parseVerb (seg, segs, flexes) {
  let vchains = []
  let last = _.last(segs)
  last.dicts.forEach(dict => { dict.dict = orthos.toComb(dict.rdict) } )
  let lastverbs = _.filter(last.dicts, dict => { return dict.verb })
  let verbflexes = _.filter(flexes, flex => { return flex.verb })
  // let advflexes = _.filter(flexes, flex => { return flex.adv })
  let partflexes = _.filter(flexes, flex => { return flex.part })
  // clog('FL', verbflexes)

  let vdicts = []
  let vfls = []
  let partdicts = []
  let partfls = []
  lastverbs.forEach(dict => {
    if (dict.plain == 'ων') log('NC-d ===========================>>>', dict)
    let fls = _.filter(verbflexes, flex => {
      if (dict.plain == 'ων' && flex.tense == 'mid.fut.ind') log('NC-f =========================', flex)
      // if (dict.reg)
      // if (!dict.reg) return filterVerb(dict, flex, first)
      return filterVerb(dict, flex)
    })
    let pfls = _.filter(partflexes, flex => {
      if (dict.plain == 'ηγαπη' && flex.tense == 'act.pf.part') log('NC-p =========================', flex)
      return filterPart(dict, flex)
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
    let cleanfls = vfls.map(flex => { return {tense: flex.tense, numper: flex.numper} })
    let jsonfls = _.uniq(cleanfls.map(flex => { return JSON.stringify(flex) }) )
    cleanfls = jsonfls.map(flex => { return JSON.parse(flex) })
    let flsobj = {seg: seg, flexes: cleanfls}
    let nchain = cloneChain(segs, vdicts, null, flsobj)
    vchains.push(nchain)
  }

  if (partdicts.length && partfls.length) {
    let cleanfls = partfls.map(flex => { return {tense: flex.tense, numcase: flex.numcase, gend: flex.gend } }) // , reg: flex.reg
    // let cleanfls = partfls.map(flex => { return flex })
    let jsonfls = _.uniq(cleanfls.map(flex => { return JSON.stringify(flex) }) )
    cleanfls = jsonfls.map(flex => { return JSON.parse(flex) })
    let flsobj = {seg: seg, flexes: cleanfls}
    let nchain = cloneChain(segs, partdicts, null, flsobj)
    vchains.push(nchain)
  }

  return vchains
}


export function parseName (seg, segs, flexes) {
  let nchains = []
  let last = _.last(segs)
  last.dicts.forEach(dict => { dict.dict = orthos.toComb(dict.rdict) } )
  let lastnames = _.filter(last.dicts, dict => { return dict.name })
  let nameflexes = _.filter(flexes, flex => { return flex.name })
  // let verbflexes = _.filter(flexes, flex => { return flex.verb })
  let advflexes = _.filter(flexes, flex => { return flex.adv })

  let ndicts = []
  let nfls = []
  lastnames.forEach(dict => {
    if (dict.plain == 'κοσι') log('NC-d ===========================>>>', dict)
    let fls = []
    nameflexes.forEach(flex => {
      if (dict.plain == 'κοσι' && flex.numcase == 'pl.nom') log('NAME-f =========================', flex)

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
    let flsobj = {seg: seg, flexes: nfls}
    let nchain = cloneChain(segs, ndicts, null, flsobj)
    nchains.push(nchain)
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

    let flsobj = {seg: seg, flexes: fls}
    let nchain = cloneChain(segs, [dict], null, flsobj)
    // _.last(nchain).flexes.forEach(flex => { delete flex.dicts, delete flex.flex }) // DELETES - изменяет flexes ! нельзя !
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
    let udict = {verb: true, rdict: dict.rdict, dname: dict.dname, trns: dict.trns, weight: dict.weight, keys: dict.keys}
    // let udict = dict
    if (dict.reg) udict.reg = true
    udicts.push(udict)
    uvkeys[uvkey] = true
  })
  return udicts
}


function filterPart(dict, flex) {
  // pf is always irregular, even if dict is reg
  if (!dict.pf && dict.reg != flex.reg) return false
  if (dict.act && flex.acts && !flex.acts.includes(dict.act)) return false
  if (dict.mp && flex.mps && !flex.mps.includes(dict.mp)) return false

  return true
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
