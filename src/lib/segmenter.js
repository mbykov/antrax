//

import {log} from './utils'
import _ from 'lodash'
import {accents as acs, vowels, mutes} from './utils'

const vows = vowels
const mts = mutes()

export function segmenter (str) {
  let old = str
  let pdchs = []

  function rec(str, pdch) {
    let flakes = scrape(str)
    flakes.forEach(flake => {
      pdch.push(flake.head)
      pdch.push(flake.tail)
      if (pdch.join('') == old) {
        pdchs.push(_.clone(pdch))
        pdch.pop()
      }
      if (pdch.length < 3) rec(flake.tail, pdch) // three parts for now ! // 5 is four parts, i.e affix, stem, suffix, flex ========= NB: ============
      // rec(flake.tail, pdch)
      pdch.pop()
    })
  }
  rec(str, [])
  return pdchs
}

export function scrape (str) {
  let total = str.length+1
  let flakes = []
  let head = str
  let pos = str.length
  let beg
  let tail
  while (pos > 0) {
    pos--
    tail = str.slice(pos)
    if (!_.intersection(vows, _.values(tail)).length && !mts.includes(tail)) continue
    head = str.substr(0, pos)
    if (!head) continue
    beg = tail[0]
    if (_.values(acs).includes(beg)) continue
    let res = {head: head, tail: tail}
    flakes.push(res)
  }
  return flakes
}
