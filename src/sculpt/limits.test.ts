import { describe, expect, it } from 'vitest'
import { maxSculptNodes } from './limits'

describe('limite di forme', () => {
  it('dipende dagli uniform della scheda video, entro 16 e 128', () => {
    expect(maxSculptNodes(224)).toBe(27) // minimo garantito da WebGL2
    expect(maxSculptNodes(1024)).toBe(128) // tipico desktop (con il tetto)
    expect(maxSculptNodes(64)).toBe(16) // mai sotto il minimo
    expect(maxSculptNodes(null)).toBe(64) // prima di conoscere la scheda
  })
})
