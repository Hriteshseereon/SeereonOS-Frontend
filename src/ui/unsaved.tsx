// Unsaved-changes guard: leaving a page (in-app navigation, back/forward, closing or reloading the tab) or discarding
// a draft asks first while there are unsaved edits.
import { useCallback, useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'
import { useConfirm } from './overlay'

const DEFAULTS = { title: 'Discard unsaved changes?', body: 'Your changes on this page haven’t been saved. If you leave now they are lost.' }

/** `dirty`: there are unsaved edits. Returns `confirmDiscard()` for in-page Discard / Cancel / Close buttons (resolves
 *  true when there is nothing to lose or the user chose to discard) and `release()`: call it right before navigating
 *  away after a successful save / delete (the guard would otherwise still see the edits of the last render). */
export function useUnsavedChanges(dirty: boolean, text: { title?: string; body?: string } = {}) {
  const { confirm } = useConfirm()
  const released = useRef(false)
  if (!dirty) released.current = false
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty && !released.current
  const t = { ...DEFAULTS, ...text }
  const tRef = useRef(t)
  tRef.current = t
  const ask = useCallback(
    () => confirm({ title: tRef.current.title, body: tRef.current.body, confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', tone: 'danger' }),
    [confirm],
  )
  // in-app navigation (links, nav(), back/forward): only a change of page, not of ?query or #hash
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirtyRef.current && currentLocation.pathname !== nextLocation.pathname)
  const asking = useRef(false)
  useEffect(() => {
    if (blocker.state !== 'blocked' || asking.current) return
    asking.current = true
    void ask().then((ok) => {
      asking.current = false
      if (ok) blocker.proceed?.()
      else blocker.reset?.()
    })
  }, [blocker, ask])
  // closing / reloading the tab: the browser's own prompt
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])
  const confirmDiscard = useCallback(async () => !dirtyRef.current || (await ask()), [ask])
  const release = useCallback(() => {
    released.current = true
    dirtyRef.current = false
  }, [])
  return { confirmDiscard, release }
}
