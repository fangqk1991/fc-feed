import { DBProtocol, DBTools, Transaction } from 'fc-sql'
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

export interface FilterOptions {
  _sortKey?: string;
  _sortDirection?: string;
  _offset?: number;
  _length?: number;
  [p: string]: any;
}

interface Params {
  [p: string]: number | string;
}

const _buildSortRule = (params: any) => {
  let sortDirection = params._sortDirection || 'ASC'
  if (!['ASC', 'DESC'].includes(sortDirection)) {
    if (sortDirection === 'ascending') {
      sortDirection = 'ASC'
    } else if (sortDirection === 'descending') {
      sortDirection = 'DESC'
    } else {
      sortDirection = 'ASC'
    }
  }

  return {
    sortKey: params._sortKey || '',
    sortDirection: sortDirection,
  }
}

const _buildLimitInfo = (params: any) => {
  let { _offset = -1, _length = -1 } = params
  _offset = Number(_offset)
  _length = Number(_length)
  return {
    offset: _offset,
    length: _length,
  }
}

/**
 * @description When FeedBase's DBProtocol exists, the sql functions would take effect
 */
export class FeedBase extends FCModel {
  protected _dbProtocol!: DBProtocol
  protected _dataBackup: { [p: string]: any } | null = null
  protected _reloadOnAdded = false
  protected _reloadOnUpdated = false
  public dbObserver?: DBObserver

  constructor() {
    super()
  }

  private updateAutoIncrementInfo(lastInsertId: number) {
    // console.log(`lastInsertId: ${lastInsertId}`)
    assert.ok(!!this._dbProtocol, '_dbProtocol must be not empty')

    if (lastInsertId > 0 && typeof this._dbProtocol.primaryKey() === 'string') {
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
   * @deprecated Use addToDB instead
   * @description Insert model data to database.
   */
  async fc_add() {
    await this.addToDB()
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
   * @deprecated Use updateToDB instead.
   * @description Must use fc_edit before fc_update, changes in editing mode will be pass to database, (Should match primary key).
   */
  async fc_update(options: { [p: string]: any } = {}): Promise<{}> {
    assert.ok(!!this._dataBackup, 'You must use fc_edit before fc_update!')

    const propertyMap = this.fc_propertyMapper()
    for (const property in propertyMap) {
      const jsonKey = propertyMap[property]
      if (jsonKey in options) {
        ;(this as MapProtocol)[property] = options[jsonKey]
      }
    }
    return this.updateToDB()
  }

  /**
   * @deprecated Use deleteFromDB instead.
   * @description Delete record in database, (Should match primary key).
   */
  async fc_delete(): Promise<void> {
    await this.deleteFromDB()
  }

  public async addToDB(transaction?: Transaction) {
    assert.ok(!!this._dbProtocol, '_dbProtocol must be not empty')

    const data = this.fc_encode()
    const tools = new DBTools(this._dbProtocol, transaction)
    const performer = tools.makeAdder(data)
    const lastInsertId = await performer.execute()
    this.updateAutoIncrementInfo(lastInsertId)
    if (this._reloadOnAdded) {
      await this.reloadDataFromDB(transaction)
    }
    if (this.dbObserver) {
      await this.dbObserver.onAdd(this)
    }
  }

  public async strongAddToDB(transaction?: Transaction) {
    assert.ok(!!this._dbProtocol, '_dbProtocol must be not empty')

    const data = this.fc_encode()
    const tools = new DBTools(this._dbProtocol, transaction)
    await tools.strongAdd(data)
    if (this._reloadOnAdded) {
      await this.reloadDataFromDB(transaction)
    }
    if (this.dbObserver) {
      await this.dbObserver.onAdd(this)
    }
  }

  public async weakAddToDB(transaction?: Transaction) {
    assert.ok(!!this._dbProtocol, '_dbProtocol must be not empty')

    const data = this.fc_encode()
    const tools = new DBTools(this._dbProtocol, transaction)
    await tools.weakAdd(data)
    if (this._reloadOnAdded) {
      await this.reloadDataFromDB(transaction)
    }
    if (this.dbObserver) {
      await this.dbObserver.onAdd(this)
    }
  }

  public async updateToDB(transaction?: Transaction) {
    assert.ok(!!this._dbProtocol, '_dbProtocol must be not empty')
    assert.ok(!!this._dataBackup, 'You must use fc_edit before fc_update!')

    const dataBackup = this._dataBackup as { [p: string]: any }
    const data = this.fc_encode()
    const params: { [p: string]: any } = {}
    const editedMap: { [p: string]: any } = {}

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

    const pKey = this._dbProtocol.primaryKey()
    const pKeys = Array.isArray(pKey) ? pKey : [pKey]
    pKeys.forEach((key: string): void => {
      params[key] = data[key]
    })
    const tools = new DBTools(this._dbProtocol, transaction)
    const performer = tools.makeModifier(params)
    await performer.execute()
    if (this._reloadOnUpdated) {
      await this.reloadDataFromDB(transaction)
    }
    if (this.dbObserver) {
      await this.dbObserver.onUpdate(this, editedMap, this._dataBackup)
    }
    this._dataBackup = null
    return editedMap
  }

  public async deleteFromDB(transaction?: Transaction) {
    assert.ok(!!this._dbProtocol, '_dbProtocol must be not empty')

    const data = this.fc_encode()
    const tools = new DBTools(this._dbProtocol, transaction)
    const performer = tools.makeRemover(data)
    await performer.execute()
    if (this.dbObserver) {
      await this.dbObserver.onDelete(this)
    }
  }

  /**
   * @description Return a FeedSearcher for current model class.
   * @param params
   */
  fc_searcher(params: FilterOptions = {}) {
    const searcher = new FeedSearcher(this)
    const mapper = this.fc_propertyMapper()
    const { sortKey, sortDirection } = _buildSortRule(params)
    if (sortKey && mapper[sortKey]) {
      searcher.processor().addOrderRule(mapper[sortKey], sortDirection)
    }
    const filterKeys = Object.keys(params).filter((key: string) => {
      return /^[a-zA-Z]\w+$/.test(key) && key in mapper && !!params[key]
    })
    filterKeys.forEach((key) => {
      searcher.processor().addConditionKV(mapper[key], params[key])
    })
    const limitInfo = _buildLimitInfo(params)
    if (limitInfo.offset >= 0 && limitInfo.length > 0) {
      searcher.processor().setLimitInfo(limitInfo.offset, limitInfo.length)
    }
    return searcher
  }

  /**
   * @description Reload data from database
   */
  public async reloadDataFromDB(transaction?: Transaction) {
    const feed = await this.findFeedInDB(transaction)
    if (feed) {
      this.fc_generate(feed.fc_encode())
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

  public async checkExistsInDB(transaction?: Transaction) {
    return !!(await this.findFeedInDB(transaction))
  }

  public async findFeedInDB(transaction?: Transaction) {
    assert.ok(!!this._dbProtocol, '_dbProtocol must be not empty')

    const data = this.fc_encode()
    const params: any = {}
    const pKey = this._dbProtocol.primaryKey()
    const pKeys = Array.isArray(pKey) ? pKey : [pKey]
    pKeys.forEach((key: string): void => {
      params[key] = data[key]
    })
    const clazz = this.constructor as any
    return (await clazz.findOne(params, transaction)) as FeedBase | undefined
  }

  public toString() {
    return `${this.constructor.name}: ${JSON.stringify(this.fc_pureModel(), null, 2)}`
  }

  public static dbSearcher(params: { [p: string]: number | string } = {}, transaction?: Transaction) {
    const feed = new this() as FeedBase
    const tools = new DBTools(feed._dbProtocol, transaction)
    return tools.makeSearcher(params)
  }
  /**
   * @description Like findWithUid, but it will throw an error if object does not exist.
   */
  public static async prepareWithUid<T extends FeedBase>(
    this: { new (): T },
    uid: string | number,
    transaction?: Transaction
  ): Promise<T> {
    const obj = await (this as any).findWithUid(uid, transaction)
    assert.ok(!!obj, `${this.constructor.name}: object not found.`)
    return obj
  }

  public static async findWithUid<T extends FeedBase>(
    this: { new (): T },
    uid: string | number,
    transaction?: Transaction
  ): Promise<T | undefined> {
    const feed = new this() as FeedBase
    const pKey = feed._dbProtocol.primaryKey()
    assert.ok(typeof pKey === 'string', 'PrimaryKey must be single item in this case.')
    const params: { [p: string]: any } = {}
    params[pKey as string] = uid
    return (this as any).findOne(params, transaction)
  }

  /**
   * @description Like findOne, but it will throw an error if object does not exist.
   */
  public static async prepareOne<T extends FeedBase>(
    this: { new (): T },
    params: Params,
    transaction?: Transaction
  ): Promise<T> {
    const obj = await (this as any).findOne(params, transaction)
    assert.ok(!!obj, `${this.constructor.name}: object not found.`)
    return obj
  }

  public static async findOne<T extends FeedBase>(
    this: { new (): T },
    params: Params,
    transaction?: Transaction
  ): Promise<T | undefined> {
    assert.ok(typeof params === 'object', `params must be an object.`)
    const feed = new this() as T
    const tools = new DBTools(feed._dbProtocol, transaction)
    const searcher = tools.makeSearcher(params)
    const data = await searcher.querySingle()
    if (data) {
      feed.fc_generate(data)
      return feed
    }
    return undefined
  }

  public static async count(params: Params = {}, transaction?: Transaction) {
    const feed = new this() as FeedBase
    const tools = new DBTools(feed._dbProtocol, transaction)
    const searcher = tools.makeSearcher(params)
    return searcher.queryCount()
  }
}
