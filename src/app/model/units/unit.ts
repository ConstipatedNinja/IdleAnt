import { summaryFileName } from '@angular/compiler/src/aot/util';
import { Base } from './base';
import { Production } from '../production';
import { first } from 'rxjs/operator/first';
import { any } from 'codelyzer/util/function';
import * as decimal from 'decimal.js';
import { GameModel } from '../gameModel';
import { GameService } from '../../game.service';
import { Cost } from '../cost';
import { Action, BuyAction } from './action';

export class Unit extends Base {

  toAdd = Decimal(0)

  producedBy = Array<Production>()
  produces = Array<Production>()
  percentage = 100

  worldProdModifiers = Decimal(1)
  worldEffModifiers = Decimal(1)
  worldBuyModifiers = Decimal(1)

  actions = Array<Action>()
  upAction: Action
  upSpecial: Action
  upHire: Action

  bonusProduction = Array<[Base, decimal.Decimal]>()
  prestigeBonusProduction = Array<Base>()
  prestigeBonusStart: Unit
  alwaysOn = false

  production = Decimal(0)

  totalPerSec = Decimal(0)
  totalProducers = Decimal(0)

  constructor(
    public model: GameModel,
    id: string,
    name: string = "",
    description: string = "",
    public neverEnding = false) {
    super(model, id)
    this.model.unitMap.set(this.id, this)
    this.name = name
    this.description = description
  }

  addProductor(prod: Production) {
    prod.productor = this
    this.producedBy.push(prod)
    prod.unit.produces.push(prod)
  }
  loadProduction() {
    let sum = Decimal(1)
    for (const p of this.prestigeBonusProduction)
      sum = sum.plus(p.quantity.times(0.3))

    this.production = this.getBoost().plus(1).times(
      (this.upSpecial ? this.upSpecial.quantity : Decimal(0)).plus(1)
    ).times(this.worldEffModifiers).times(sum)

    this.totalProducers = Decimal(0)
    this.totalPerSec = Decimal(0)

    this.producedBy.filter(p => p.unlocked && p.unit.unlocked).forEach(p => {
      this.totalPerSec = this.totalPerSec.plus(p.getprodPerSec().times(p.unit.quantity))
      this.totalProducers = this.totalProducers.plus(p.unit.quantity)
    })

  }
  getBoost(): decimal.Decimal {
    return this.model.research.up1.owned() && this.buyAction ?
      this.buyAction.quantity.times(0.005)
        .times(this.upAction ? this.upAction.quantity.plus(1) : Decimal(0))
      : Decimal(0)
  }
  getProduction() {
    // this.loadProduction()
    return this.production
  }

  //     Save and Load
  getData() {
    const data: any = super.getData()
    data.a = this.actions.filter(a => a.unlocked).map(a => a.getData())
    data.w = this.worldProdModifiers
    data.e = this.worldEffModifiers
    data.b = this.worldBuyModifiers
    data.r = this.percentage
    data.p = this.producedBy.map(p => [p.unit.id, p.unlocked])
    return data;
  }
  restore(data: any) {
    super.restore(data)
    if (data.w)
      this.worldProdModifiers = new Decimal(data.w)
    if (data.e)
      this.worldEffModifiers = new Decimal(data.e)
    if (data.b)
      this.worldBuyModifiers = new Decimal(data.b)
    if (data.a)
      for (const s of data.a)
        this.actions.find(a => a.id === s.id).restore(s)
    if (data.p)
      data.p.forEach(e => {
        const prod = this.producedBy.find(p => p.unit.id === e[0])
        if (prod)
          prod.unlocked = e[1]
      });
    // if (data.r)
    this.percentage = data.r
  }

  isEnding(): boolean {
    if (this.neverEnding)
      return false
    return super.isEnding()
  }

  initialize() {
    super.initialize()

    if (this.prestigeBonusStart) {
      this.quantity = Decimal(5).times(this.prestigeBonusStart.quantity)
      if (this.quantity.greaterThan(0))
        this.unlocked = true
    }

    this.producedBy.forEach(p => p.unlocked = p.defaultUnlocked)
  }

  isStopped() {
    return this.percentage < Number.EPSILON
  }

  haveUp() {
    return (this.upSpecial ? this.upSpecial.maxBuy.greaterThanOrEqualTo(1) : false) ||
    (this.upHire ? this.upHire.maxBuy.greaterThanOrEqualTo(1) : false)

    // return (this.upSpecial ? this.upSpecial.getBuyMax().greaterThanOrEqualTo(1) : false) ||
    //   (this.upHire ? this.upHire.getBuyMax().greaterThanOrEqualTo(1) : false)
  }

  reloadtAct() {
    this.actions.forEach(a => {
      a.realPriceNow = a.getCosts()
    })
  }

  reloadAtcMaxBuy() {
    this.actions.forEach(a => a.setMaxBuy())
  }

}
