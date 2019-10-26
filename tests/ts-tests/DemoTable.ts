import { DBObserver, FeedBase } from '../../src'
import { DBProtocol, FCDatabase } from 'fc-sql'

const database = FCDatabase.getInstance()
database.init({
  host: '127.0.0.1',
  port: 3306,
  dialect: 'mysql',
  database: 'demo_db',
  username: 'root',
  password: '',
  timezone: '+08:00',
  // logging: false,
  // dialectOptions: {
  //   dateStrings: true,
  //   typeCast: true,
  // }
})

class MyProtocol implements DBProtocol {
  database(): FCDatabase {
    return database
  }

  table(): string {
    return 'demo_table'
  }

  primaryKey(): string {
    return 'uid'
  }

  cols(): string[] {
    return [
      'uid',
      'key1',
      'key2',
      'some_date',
      'some_datetime',
      'create_time',
      'update_time',
    ]
  }

  insertableCols(): string[] {
    return [
      'key1',
      'key2',
      'some_date',
      'some_datetime',
    ]
  }

  modifiableCols(): string[] {
    return [
      'key1',
      'key2',
    ]
  }
}

class MyObserver implements DBObserver {
  async onAdd(newFeed: FeedBase): Promise<void> {
    console.log(`onAdd: `, newFeed.toString())
  }

  async onDelete(oldFeed: FeedBase): Promise<void> {
    console.log(`onDelete: `, oldFeed.toString())
  }

  async onUpdate(newFeed: FeedBase, changedMap: any): Promise<void> {
    console.log(`onUpdate: `, newFeed.toString(), changedMap)
  }
}

export default class DemoTable extends FeedBase {
  uid: any = null
  key1: any = null
  key2: any = null
  createTime: any = null
  updateTime: any = null

  constructor() {
    super()
    this._dbProtocol = new MyProtocol()
    this.dbObserver = new MyObserver()
    this._reloadOnAdded = true
    this._reloadOnUpdated = true
  }

  fc_propertyMapper(): { [p: string]: string } {
    return {
      uid: 'uid',
      key1: 'key1',
      key2: 'key2',
      createTime: 'create_time',
      updateTime: 'update_time',
    }
  }

  customFunc() {}
}
