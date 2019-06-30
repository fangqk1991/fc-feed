const DBProtocol = require('fc-sql/DBProtocol')
const DBTools = require('fc-sql/DBTools')
const assert = require('assert')

class FeedSearcher {
  /**
   * @param modelInstance {FeedBase}
   */
  constructor(modelInstance) {
    const protocol = modelInstance.dbProtocol()
    assert.ok(protocol instanceof DBProtocol, `${modelInstance.constructor.name} must implements DBProtocol`)
    const searcher = protocol.database().searcher()
    searcher.setTable(protocol.table())
    searcher.setColumns(protocol.cols())
    this._searcher = searcher
    this._protocol = protocol
    this._model = modelInstance.constructor
  }

  /**
   * @returns {SQLSearcher}
   */
  processor() {
    return this._searcher
  }

  /**
   * @param retFeed
   * @returns {Promise<null|FeedBase>}
   */
  async querySingle(retFeed = true) {
    const items = await this.queryList(0, 1, retFeed)
    if (items.length > 0) {
      return items[0]
    }
    return null
  }

  /**
   * @param retFeed {Boolean}
   * @returns {Promise<Array>}
   */
  async queryAll(retFeed = false) {
    return this.queryList(-1, 0, retFeed)
  }

  /**
   * @param page {Number}
   * @param length {Number}
   * @param retFeed {Boolean}
   * @returns {Promise<Array>}
   */
  async queryList(page, length, retFeed = false) {
    this._searcher.setPageInfo(page, length)
    const items = await this._searcher.queryList()
    return this.formatList(items, retFeed)
  }

  /**
   * @returns {Promise<Number>}
   */
  async queryCount() {
    return this._searcher.queryCount()
  }

  /**
   * @param items
   * @param retFeed
   * @returns {Array}
   */
  formatList(items, retFeed = false) {
    return items.map(dic => {
      const obj = new this._model()
      obj.fc_generate(dic)
      return retFeed ? obj : obj.fc_retMap()
    })
  }

  /**
   * @param params {Object}
   * @param checkPrimaryKey {Boolean}
   * @returns {Promise<FeedBase>}
   */
  async prepareWithParams(params, checkPrimaryKey = true) {
    const obj = await this.findWithParams(params, checkPrimaryKey)
    assert.ok(!!obj, `${this.constructor.name}: object not found.`)
    return obj
  }

  /**
   * @param params {Object}
   * @param checkPrimaryKey {Boolean}
   * @returns {Promise<FeedBase|null>}
   */
  async findWithParams(params, checkPrimaryKey = true) {
    const tools = new DBTools(this._protocol)
    const data = await tools.searchSingle(params, checkPrimaryKey)
    if (data) {
      const obj = new this._model()
      obj.fc_generate(data)
      return obj
    }
    return null
  }

  /**
   * @param uid
   * @returns {Promise<FeedBase>}
   */
  async prepareWithUID(uid) {
    const obj = await this.findWithUID(uid)
    assert.ok(!!obj, `${this.constructor.name}: object not found.`)
    return obj
  }

  /**
   * @param uid {String}
   * @returns {Promise<FeedBase|null>}
   */
  async findWithUID(uid) {
    const pKey = this._protocol.primaryKey()
    if (typeof pKey === 'string') {
      const params = {}
      params[pKey] = uid
      return this.findWithParams(params)
    }
    assert.fail(`${this._model.name}: primary key is not single.`)
  }

  /**
   * @param params {Object|string|Number}
   * @returns {Promise<boolean>}
   */
  async checkExists(params) {
    if (typeof params !== 'object') {
      const pKey = this._protocol.primaryKey()
      assert.ok(typeof pKey === 'string', `${this.constructor.name}: primaryKey must be an string.`)
      const uid = params
      params = {}
      params[pKey] = uid
    }
    const tools = new DBTools(this._protocol)
    return (await tools.fetchCount(params)) > 0
  }
}

module.exports = FeedSearcher
