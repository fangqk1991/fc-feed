import _DemoTable from './DemoTable'

export default class DemoTable extends _DemoTable {
  static async createFeed(key1: string, key2: string): Promise<void> {
    const feed = new DemoTable()
    feed.key1 = key1
    feed.key2 = key2
    await feed.addToDB()
  }

  static async allFeeds() {
    const searcher = new DemoTable().fc_searcher()
    return searcher.queryAllFeeds()
  }
}
