export function useEndpointSwitcher() {
  const isOpen = useState('endpoint-switcher-open', () => false)

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  return { isOpen, open, close }
}
