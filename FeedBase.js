const FCModel = require('fc-model')
const DBTools = require('fc-sql/DBTools')
const assert = require('assert')

class FeedBase extends FCModel {
  // eslint-disable-next-line no-useless-constructor
  constructor() {
    super()
  }

  /**
   * @returns {DBProtocol|null}
   */
  dbProtocol() {
    return null
  }

  fc_uidStr() {
    const data = this.fc_encode()
    let uid = ''
    const pKey = this.dbProtocol().primaryKey()
    if (Array.isArray(pKey)) {
      uid = pKey.map(key => `${data[key]}`).join(',')
    } else {
      uid = data[pKey]
    }
    return uid
  }

  async fc_add() {
    const data = this.fc_encode()
    if (this.dbProtocol()) {
      const tools = new DBTools(this.dbProtocol())
      await tools.add(data)
    }
  }

  fc_edit() {
    this._dataBackup = this.fc_encode()
  }

  _checkKeyChanged(key) {
    if (this._dataBackup) {
      const propertyMap = this.fc_propertyMapper()
      for (const p in propertyMap) {
        if (propertyMap.hasOwnProperty(p)) {
          const k = propertyMap[p]
          if (key === k) {
            if (this._dataBackup[key] && this._dataBackup[key] !== this[propertyMap[p]]) {
              return true
            }
            break
          }
        }
      }
    }
    return false
  }

  /**
   * @param options {Object}
   * @returns {Promise<Object>}
   */
  async fc_update(options = {}) {
    assert.ok(!!this._dataBackup, 'You must use fc_edit before fc_update!')

    const propertyMap = this.fc_propertyMapper()
    for (const property in propertyMap) {
      if (propertyMap.hasOwnProperty(property)) {
        const jsonKey = propertyMap[property]
        if (jsonKey in options) {
          this[property] = options[jsonKey]
        }
      }
    }

    const data = this.fc_encode()
    const params = {}
    const editedMap = {}

    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        const value = data[key]
        if (!(key in this._dataBackup)) {
          continue
        }
        if (this._dataBackup[key] === value) {
          continue
        }

        params[key] = value
        editedMap[key] = {
          before: this._dataBackup[key],
          after: value,
        }
      }
    }

    if (Object.keys(params).length === 0) {
      return {}
    }

    if (this.dbProtocol()) {
      const pKey = this.dbProtocol().primaryKey()
      const pKeys = Array.isArray(pKey) ? pKey : [pKey]
      pKeys.forEach(key => {
        params[key] = data[key]
      })
      const tools = new DBTools(this.dbProtocol())
      await tools.update(params)
    }
    this._dataBackup = null
    return editedMap
  }

  async fc_delete() {
    const data = this.fc_encode()
    if (this.dbProtocol()) {
      const tools = new DBTools(this.dbProtocol())
      await tools.delete(data)
    }
  }

  /**
   * @param params {Object}
   */
  fc_searcher(params = {}) {
    const FeedSearcher = require('./FeedSearcher')
    return new FeedSearcher(this)
  }
}

module.exports = FeedBase
