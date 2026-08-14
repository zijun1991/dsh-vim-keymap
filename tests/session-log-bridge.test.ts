/** saveSessionLog: dispatches a real click on the host's "Session log" button, matched by its visible text (its only stable identifier — see the module doc). */
import { describe, expect, it } from 'vitest'
import { saveSessionLog } from '../src/client/session/session-log-bridge.ts'

describe('saveSessionLog', () => {
  it('clicks the button whose text is exactly "Session log"', () => {
    const root = document.createElement('div')
    root.innerHTML = '<button class="hashedClass"><span>Session log</span></button>'
    document.body.appendChild(root)

    let clicks = 0
    root.querySelector('button')?.addEventListener('click', () => { clicks += 1 })

    expect(saveSessionLog(root)).toBe(true)
    expect(clicks).toBe(1)

    root.remove()
  })

  it('returns false when no such button is on screen', () => {
    const root = document.createElement('div')
    root.innerHTML = '<button>Something else</button>'
    document.body.appendChild(root)

    expect(saveSessionLog(root)).toBe(false)

    root.remove()
  })
})
