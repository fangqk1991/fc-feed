import { DBProtocol, DBTools, SQLSearcher } from 'fc-sql'
import { FeedBase } from './FeedBase'
import * as assert from 'assert'

export class FeedSearcher {
  private readonly _searcher: SQLSearcher
  private readonly _protocol: DBProtocol
  private readonly _model: { new(): FeedBase }

  constructor(modelInstance: FeedBase) {
    const protocol = modelInstance.dbProtocol()
    assert.ok(!!protocol, `${modelInstance.constructor.name} must have DBProtocol`)
    const searcher = protocol.database().searcher()
    searcher.setTable(protocol.table())
    searcher.setColumns(protocol.cols())
    this._searcher = searcher
    this._protocol = protocol
    this._model = modelInstance.constructor as { new(): FeedBase }
  }

  processor(): SQLSearcher {
    return this._searcher
  }

  async querySingle(retFeed = true): Promise<null | FeedBase | {[p: string]: any}> {
    const items = await this.queryList(0, 1, retFeed)
    if (items.length > 0) {
      return items[0]
    }
    return null
  }

  async queryAll(retFeed: boolean = false): Promise<({[p: string]: any} | FeedBase)[]> {
    return this.queryList(-1, 0, retFeed)
  }

  async queryList(page: number, length: number, retFeed: boolean = false): Promise<({[p: string]: any} | FeedBase)[]> {
    this._searcher.setPageInfo(page, length)
    const items = await this._searcher.queryList()
    return this.formatList(items, retFeed)
  }

  async queryCount(): Promise<number> {
    return this._searcher.queryCount()
  }

  formatList(items: {}[], retFeed = false): ({[p: string]: any} | FeedBase)[] {
    return items.map((dic: {}): {[p: string]: any} | FeedBase => {
      const obj = new this._model()
      obj.fc_generate(dic)
      return retFeed ? obj : obj.fc_retMap()
    })
  }

  async prepareWithParams(params: {}, checkPrimaryKey: boolean = true): Promise<FeedBase | null> {
    const obj = await this.findWithParams(params, checkPrimaryKey)
    assert.ok(!!obj, `${this.constructor.name}: object not found.`)
    return obj
  }

  async findWithParams(params: {}, checkPrimaryKey = true): Promise<null | FeedBase> {
    const tools = new DBTools(this._protocol)
    const data = await tools.searchSingle(params, checkPrimaryKey)
    if (data) {
      const obj = new this._model()
      obj.fc_generate(data)
      return obj
    }
    return null
  }

  async prepareWithUID(uid: string | number): Promise<FeedBase | null | undefined> {
    const obj = await this.findWithUID(uid)
    assert.ok(!!obj, `${this.constructor.name}: object not found.`)
    return obj
  }

  async findWithUID(uid: string | number): Promise<FeedBase | null | undefined> {
    const pKey = this._protocol.primaryKey()
    if (typeof pKey === 'string') {
      const params: {[p: string]: any} = {}
      params[pKey as string] = uid
      return this.findWithParams(params)
    }
    assert.fail(`${this._model.name}: primary key is not single.`)
  }

  async checkExists(params: {[p: string]: any} | string | number): Promise<boolean> {
    if (typeof params !== 'object') {
      const pKey = this._protocol.primaryKey()
      assert.ok(typeof pKey === 'string', `${this.constructor.name}: primaryKey must be an string.`)
      const uid = params
      const params1: {[p: string]: any} = {}
      params1[pKey as string] = uid
      params = params1
    }
    const tools = new DBTools(this._protocol)
    return (await tools.fetchCount(params)) > 0
  }
}
