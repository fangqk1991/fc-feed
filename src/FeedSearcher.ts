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

  /**
   * @deprecated Return model instance is recommended, please use queryOne instead.
   * @description Query single object, return an model instance when retFeed = true
   * @param retFeed
   */
  async querySingle(retFeed = true): Promise<null | FeedBase | {[p: string]: any}> {
    const items = await this.queryList(0, 1, retFeed)
    if (items.length > 0) {
      return items[0]
    }
    return null
  }

  /**
   * @deprecated Return model instance is recommended, please use queryAllFeeds instead.
   * @param retFeed {boolean}
   */
  async queryAll(retFeed: boolean = false): Promise<({[p: string]: any} | FeedBase)[]> {
    return this.queryList(-1, 0, retFeed)
  }

  /**
   * @deprecated Return model instance is recommended, please use queryListWithPageInfo instead.
   * @param page {number}
   * @param length {number}
   * @param retFeed {boolean}
   */
  async queryList(page: number, length: number, retFeed: boolean = false): Promise<({[p: string]: any} | FeedBase)[]> {
    this._searcher.setPageInfo(page, length)
    const items = await this._searcher.queryList()
    return this.formatList(items, retFeed)
  }

  formatList(items: {}[], retFeed = false): ({[p: string]: any} | FeedBase)[] {
    return items.map((dic: {}): {[p: string]: any} | FeedBase => {
      const obj = new this._model()
      obj.fc_generate(dic)
      return retFeed ? obj : obj.fc_encode()
    })
  }

  /**
   * @description Return record count.
   */
  async queryCount(): Promise<number> {
    return this._searcher.queryCount()
  }

  /**
   * @description Return a model instance.
   */
  async queryOne(): Promise<null | FeedBase> {
    const items = await this.queryListWithLimitInfo(0, 1)
    if (items.length > 0) {
      return items[0]
    }
    return null
  }

  /**
   * @description Return model list, pass page index and lengthPerPage to build limit info, page's first index is 0.
   * @param page {number}
   * @param lengthPerPage {number}
   */
  async queryListWithPageInfo(page: number, lengthPerPage: number): Promise<FeedBase[]> {
    this._searcher.setPageInfo(page, lengthPerPage)
    const items = await this._searcher.queryList()
    return this.formatList(items, true) as FeedBase[]
  }

  /**
   * @description Return model list, pass offset and length to build limit info.
   * @param offset {number}
   * @param length {number}
   */
  async queryListWithLimitInfo(offset: number, length: number): Promise<FeedBase[]> {
    this._searcher.setLimitInfo(offset, length)
    const items = await this._searcher.queryList()
    return this.formatList(items, true) as FeedBase[]
  }

  /**
   * @description Return model list
   */
  async queryAllFeeds(): Promise<FeedBase[]> {
    const items = await this._searcher.queryList()
    return this.formatList(items, true) as FeedBase[]
  }

  /**
   * @description Return model list
   */
  async queryFeeds(): Promise<FeedBase[]> {
    const items = await this._searcher.queryList()
    return this.formatList(items, true) as FeedBase[]
  }

  /**
   * @deprecated Use FeedBase.prepareOne instead.
   * @description Like findWithParams, but it will throw an error if object does not exist.
   */
  async prepareWithParams(params: {}): Promise<FeedBase | null> {
    const obj = await this.findWithParams(params)
    assert.ok(!!obj, `${this.constructor.name}: object not found.`)
    return obj
  }

  /**
   * @deprecated Use FeedBase.findOne instead.
   * @description Find model with { key => value } conditions, and return first object. "checkPrimaryKey = true" means it will check the primaryKeys defined in protocol.
   * @param params
   */
  async findWithParams(params: {}): Promise<null | FeedBase> {
    const tools = new DBTools(this._protocol)
    const data = await tools.makeSearcher(params).querySingle()
    if (data) {
      const obj = new this._model()
      obj.fc_generate(data)
      return obj
    }
    return null
  }

  /**
   * @deprecated Use FeedBase.prepareWithUID instead.
   * @description Like findWithUID, but it will throw an error if object does not exist.
   * @param uid {string | number}
   */
  async prepareWithUID(uid: string | number): Promise<FeedBase | null | undefined> {
    const obj = await this.findWithUID(uid)
    assert.ok(!!obj, `${this.constructor.name}: object not found.`)
    return obj
  }

  /**
   * @deprecated Use FeedBase.findWithUID instead.
   * @description Find Model which single-primary-key
   * @param uid {string | number}
   */
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
    return (await tools.makeSearcher(params).queryCount()) > 0
  }
}
