import { ethers } from 'ethers'
import ABI from '../../ABI.json'

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0x6b9883147df0928a14a9C9B842b0aD2fd399955d'
export const FUJI_RPC = import.meta.env.VITE_FUJI_RPC || 'https://api.avax-test.network/ext/bc/C/rpc'

let selectedInjectedProvider = null

export function getInjectedProviders(){
  if(typeof window === 'undefined' || !window.ethereum) return []

  const providers = Array.isArray(window.ethereum.providers) && window.ethereum.providers.length
    ? window.ethereum.providers
    : [window.ethereum]
  return [...new Set(providers.filter(Boolean))]
}

export function getInjectedProvider(){
  return selectedInjectedProvider || getInjectedProviders()[0] || null
}

export function setInjectedProvider(provider){
  selectedInjectedProvider = provider
}

export function getProvider(){
  const injectedProvider = getInjectedProvider()
  if(injectedProvider){
    return new ethers.BrowserProvider(injectedProvider)
  }
  return new ethers.JsonRpcProvider(FUJI_RPC)
}

export function getContract(signerOrProvider, address = CONTRACT_ADDRESS){
  return new ethers.Contract(address, ABI, signerOrProvider)
}
