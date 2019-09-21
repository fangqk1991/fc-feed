import * as assert from 'assert'
import DemoTable from './DemoTable'

describe('Test DemoTable', (): void => {
  it(`Test Normal Feed`, async (): Promise<void> => {
    const searcher = new DemoTable().fc_searcher()
    const countBefore = await searcher.queryCount()

    const count = 5
    for (let i = 0; i < count; ++i) {
      const feed = new DemoTable()
      feed.key1 = `K1 - ${Math.random()}`
      feed.key2 = `K2 - ${Math.random()}`
      await feed.fc_add()
    }

    const countAfter = await searcher.queryCount()
    assert.ok(countBefore + count === countAfter)

    {
      const items = await searcher.queryAll()
      const watchUID = (items[0] as any)['uid'] as string
      const feed = await new DemoTable().fc_searcher().findWithParams({
        uid: watchUID
      }) as DemoTable
      feed.fc_edit()
      feed.key1 = 'K1 - New'
      await feed.fc_update()

      const feed2 = await new DemoTable().fc_searcher().findWithParams({
        uid: watchUID
      }) as DemoTable

      assert.ok(feed.uid === feed2.uid)
      assert.ok(feed.key2 === feed2.key2)
      assert.ok(feed2.key1 === 'K1 - New')

      await feed.fc_delete()

      const feed3 = await new DemoTable().fc_searcher().findWithParams({
        uid: watchUID
      }) as DemoTable
      assert.ok(feed3 === null)
    }

    {
      const items = (await searcher.queryAllFeeds()) as DemoTable[]
      const watchUID = items[0].uid
      const feed = await new DemoTable().fc_searcher().findWithParams({
        uid: watchUID
      }) as DemoTable
      feed.fc_edit()
      feed.key1 = 'K1 - New'
      await feed.fc_update()

      const feed2 = await new DemoTable().fc_searcher().findWithParams({
        uid: watchUID
      }) as DemoTable

      assert.ok(feed.uid === feed2.uid)
      assert.ok(feed.key2 === feed2.key2)
      assert.ok(feed2.key1 === 'K1 - New')

      await feed.fc_delete()

      const feed3 = await new DemoTable().fc_searcher().findWithParams({
        uid: watchUID
      }) as DemoTable
      assert.ok(feed3 === null)
    }
  })
})
