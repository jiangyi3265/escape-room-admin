import JSEncrypt from 'jsencrypt/bin/jsencrypt.min'

// Public-key encryption only. Private keys must stay on the server.
export function encrypt(text, publicKey) {
  if (!publicKey) throw new Error('A server-provided public key is required')
  const encryptor = new JSEncrypt()
  encryptor.setPublicKey(publicKey)
  return encryptor.encrypt(text)
}
