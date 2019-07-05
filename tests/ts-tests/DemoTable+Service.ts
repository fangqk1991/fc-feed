import DemoTable from './DemoTable'

class DemoTable_Ext extends DemoTable {
  static async createFeed(key1: string, key2: string): Promise<void> {
    const feed = new DemoTable()
    feed.key1 = key1
    feed.key2 = key2
    await feed.fc_add()
  }

  static async count(): Promise<number> {
    const searcher = new DemoTable().fc_searcher()
    return searcher.queryCount()
  }
}

export default DemoTable_Ext
