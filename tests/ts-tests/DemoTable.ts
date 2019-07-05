import { FeedBase } from '../../src'
import { DBProtocol, FCDatabase } from 'fc-sql'

const database = FCDatabase.getInstance()
database.init({
  host: '127.0.0.1',
  port: '3306',
  dialect: 'mysql',
  database: 'demo_db',
  username: 'root',
  password: '',
  timezone: '+08:00',
  // logging: false,
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
    ]
  }

  insertableCols(): string[] {
    return this.cols()
  }

  modifiableCols(): string[] {
    return [
      'key1',
      'key2',
    ]
  }
}

export default class DemoTable extends FeedBase {
  uid: any = null
  key1: any = null
  key2: any = null

  constructor() {
    super()
    this._dbProtocol = new MyProtocol()
  }

  fc_propertyMapper(): { [p: string]: string } {
    return {
      uid: 'uid',
      key1: 'key1',
      key2: 'key2',
    }
  }
}
