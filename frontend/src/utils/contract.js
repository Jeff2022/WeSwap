import { ethers } from 'ethers'
import ABI from '../../ABI.json'

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0x6b9883147df0928a14a9C9B842b0aD2fd399955d'
export const FUJI_RPC = import.meta.env.VITE_FUJI_RPC || 'https://api.avax-test.network/ext/bc/C/rpc'

export function getProvider(){
  if(window.ethereum){
    return new ethers.BrowserProvider(window.ethereum)
  }
  return new ethers.JsonRpcProvider(FUJI_RPC)
}

export function getContract(signerOrProvider, address = CONTRACT_ADDRESS){
  return new ethers.Contract(address, ABI, signerOrProvider)
}
