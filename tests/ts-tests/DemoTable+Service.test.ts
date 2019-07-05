import * as assert from 'assert'
import DemoTable from './DemoTable+Service'

describe('Test DemoTable', (): void => {
  it(`Test Normal Feed`, async (): Promise<void> => {
    const countBefore = await DemoTable.count()

    const count = 5
    for (let i = 0; i < count; ++i) {
      await DemoTable.createFeed(`K1 - ${Math.random()}`, `K2 - ${Math.random()}`)
    }

    const countAfter = await DemoTable.count()
    assert.ok(countBefore + count === countAfter)
  })
})
