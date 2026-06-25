export const SETUP_DEFAULT_ENDPOINT = {
  url: '//coding.xinshucredit.com/mihomo',
  secret: 'Xinshu&527',
} as const

export function resolveSetupDefaultEndpoint(defaultBackendURL: string) {
  return {
    url: defaultBackendURL,
    secret:
      defaultBackendURL === SETUP_DEFAULT_ENDPOINT.url
        ? SETUP_DEFAULT_ENDPOINT.secret
        : '',
  }
}
