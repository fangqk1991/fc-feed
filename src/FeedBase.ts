import { DBTools, DBProtocol } from 'fc-sql'
import { FCModel } from 'fc-model'
import { FeedSearcher } from './FeedSearcher'
import * as assert from 'assert'

interface MapProtocol {
  [p: string]: any;
}

export interface DBObserver {
  onAdd(newFeed: FeedBase): Promise<void>;
  onUpdate(newFeed: FeedBase, changedMap: any, oldData?: any): Promise<void>;
  onDelete(oldFeed: FeedBase): Promise<void>;
}

/**
 * @description When FeedBase's DBProtocol exists, the sql functions would take effect
 */
export class FeedBase extends FCModel {
  protected _dbProtocol?: DBProtocol
  protected _dataBackup: {[p: string]: any} | null = null
  protected _reloadOnAdded = false
  protected _reloadOnUpdated = false
  public dbObserver?: DBObserver

  constructor() {
    super()
  }

  private updateAutoIncrementInfo(lastInsertId: number) {
    if (lastInsertId > 0 && this._dbProtocol && typeof this._dbProtocol.primaryKey() === 'string') {
      const primaryKey = this._dbProtocol.primaryKey()
      const mapper = this.fc_propertyMapper()
      for (const propertyKey in mapper) {
        if (mapper[propertyKey] === primaryKey) {
          const _this = this as any
          if (_this[propertyKey] === null || _this[propertyKey] === undefined) {
            _this[propertyKey] = lastInsertId
          }
          break
        }
      }
    }
  }

  /**
   * @description Sub class can override the function.
   */
  dbProtocol(): DBProtocol {
    return this._dbProtocol as DBProtocol
  }

  /**
   * @description Return primary-key, when th db-protocol has multi-primary-keys, method will use ',' join the keys then return.
   */
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

  /**
   * @description Insert model data to database.
   */
  async fc_add(): Promise<void> {
    const data = this.fc_encode()
    if (this._dbProtocol) {
      const tools = new DBTools(this._dbProtocol)
      const lastInsertId = await tools.add(data)
      this.updateAutoIncrementInfo(lastInsertId)

      if (this._reloadOnAdded) {
        await this.reloadDataFromDB()
      }

      if (this.dbObserver) {
        await this.dbObserver.onAdd(this)
      }
    }
  }

  /**
   * @description Use the editing mode
   */
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

  /**
   * @description Must use fc_edit before fc_update, changes in editing mode will be pass to database, (Should match primary key).
   */
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

      if (this._reloadOnUpdated) {
        await this.reloadDataFromDB()
      }

      if (this.dbObserver) {
        await this.dbObserver.onUpdate(this, editedMap, this._dataBackup)
      }
    }
    this._dataBackup = null
    return editedMap
  }

  /**
   * @description Delete record in database, (Should match primary key).
   */
  async fc_delete(): Promise<void> {
    const data = this.fc_encode()
    if (this._dbProtocol) {
      const tools = new DBTools(this._dbProtocol)
      await tools.delete(data)

      if (this.dbObserver) {
        await this.dbObserver.onDelete(this)
      }
    }
  }

  /**
   * @description Return a FeedSearcher for current model class.
   * @param params
   */
  // eslint-disable-next-line no-unused-vars,@typescript-eslint/no-unused-vars
  fc_searcher(params: {[p: string]: any} = {}): FeedSearcher {
    return new FeedSearcher(this)
  }

  /**
   * @description Reload data from database
   */
  public async reloadDataFromDB() {
    if (this._dbProtocol) {
      const feed = await this.findFeedInDB()
      if (feed) {
        this.fc_generate(feed.fc_encode())
      }
    }
    return this
  }

  public cleanFilterParams(params: { [p: string]: any }) {
    const retData = Object.assign({}, params)
    const mapper = this.fc_propertyMapper()
    for (const key in params) {
      if (!(key in mapper)) {
        delete retData[key]
      }
    }
    return retData
  }

  public async checkExistsInDB() {
    return (await this.findFeedInDB()) !== null
  }

  public async findFeedInDB() {
    if (this._dbProtocol) {
      const data = this.fc_encode()
      const params: any = {}
      const pKey = this._dbProtocol.primaryKey()
      const pKeys = Array.isArray(pKey) ? pKey : [pKey]
      pKeys.forEach((key: string): void => {
        params[key] = data[key]
      })
      return (await this.fc_searcher().findWithParams(params)) as FeedBase | null
    }
    return null
  }

  public toString() {
    return `${this.constructor.name}: ${JSON.stringify(this.fc_pureModel(), null, 2)}`
  }
}
