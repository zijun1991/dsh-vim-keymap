/**
 * Drives the host's own "Session log" download button — the closest existing
 * UI affordance to "save this session". No public API carries a save/export
 * verb for this: `InputActions`/`SessionInput`
 * (`@deepseek-ai/dsh-client-ui-conversation`'s published contract) expose
 * draft/image/submit operations only, nothing session-persistence-shaped.
 * So, like `WorkspaceTreeBridge` (see tree-bridge.ts), this drives the real,
 * rendered DOM the same way a mouse user would: a dispatched click on the
 * button. Confirmed against a real running `dsh --profile web` instance that
 * this button carries no `aria-label` and a build-hashed CSS-module class —
 * its visible text "Session log" is the only stable thing to match on.
 */
export function saveSessionLog(root: Document | HTMLElement = document): boolean {
  const button = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .find(el => el.textContent?.trim() === 'Session log')
  if (button === undefined) return false
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  return true
}
