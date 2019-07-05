import { DBTools, DBProtocol } from 'fc-sql'
import { FCModel } from 'fc-model'
import { FeedSearcher } from './FeedSearcher'
import * as assert from 'assert'

interface MapProtocol {
  [p: string]: any;
}

export class FeedBase extends FCModel {
  protected _dbProtocol: DBProtocol|null = null
  protected _dataBackup: {[p: string]: any}|null = null

  constructor() {
    super()
  }

  dbProtocol(): DBProtocol {
    return this._dbProtocol as DBProtocol
  }

  fc_uidStr(): string {
    const data = this.fc_encode()
    assert.ok(!!this._dbProtocol, 'this._dbProtocol must be an instance of DBProtocol')

    let uid = ''
    const protocol = this._dbProtocol as DBProtocol
    const pKey = protocol.primaryKey()
    if (Array.isArray(pKey)) {
      uid = pKey.map((key: string): string => `${data[key]}`).join(',')
    } else {
      uid = data[pKey]
    }
    return uid
  }

  async fc_add(): Promise<void> {
    const data = this.fc_encode()
    if (this._dbProtocol) {
      const tools = new DBTools(this._dbProtocol)
      await tools.add(data)
    }
  }

  fc_edit(): void {
    this._dataBackup = this.fc_encode()
  }

  _checkKeyChanged(key: string): boolean {
    if (this._dataBackup) {
      const propertyMap = this.fc_propertyMapper()
      for (const p in propertyMap) {
        const k = propertyMap[p]
        if (key === k) {
          if (this._dataBackup[key] && this._dataBackup[key] !== (this as MapProtocol)[k]) {
            return true
          }
          break
        }
      }
    }
    return false
  }

  async fc_update(options: {[p: string]: any} = {}): Promise<{}> {
    assert.ok(!!this._dataBackup, 'You must use fc_edit before fc_update!')

    const propertyMap = this.fc_propertyMapper()
    for (const property in propertyMap) {
      const jsonKey = propertyMap[property]
      if (jsonKey in options) {
        (this as MapProtocol)[property] = options[jsonKey]
      }
    }

    const dataBackup = this._dataBackup as {[p: string]: any}
    const data = this.fc_encode()
    const params: {[p: string]: any} = {}
    const editedMap: {[p: string]: any} = {}

    for (const key in data) {
      const value = data[key]
      if (!(key in dataBackup)) {
        continue
      }
      if (dataBackup[key] === value) {
        continue
      }

      params[key] = value
      editedMap[key] = {
        before: dataBackup[key],
        after: value,
      }
    }

    if (Object.keys(params).length === 0) {
      return {}
    }

    if (this._dbProtocol) {
      const pKey = this._dbProtocol.primaryKey()
      const pKeys = Array.isArray(pKey) ? pKey : [pKey]
      pKeys.forEach((key: string): void => {
        params[key] = data[key]
      })
      const tools = new DBTools(this._dbProtocol)
      await tools.update(params)
    }
    this._dataBackup = null
    return editedMap
  }

  async fc_delete(): Promise<void> {
    const data = this.fc_encode()
    if (this._dbProtocol) {
      const tools = new DBTools(this._dbProtocol)
      await tools.delete(data)
    }
  }

  // eslint-disable-next-line no-unused-vars,@typescript-eslint/no-unused-vars
  fc_searcher(params: {[p: string]: any} = {}): FeedSearcher {
    return new FeedSearcher(this)
  }
}
