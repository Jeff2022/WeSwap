import React, {useEffect, useState} from 'react'
import { getProvider, getContract, CONTRACT_ADDRESS } from '../utils/contract'
import { formatEther, formatUnits } from 'ethers'

export default function AdminPage(){
  const [contractAddr, setContractAddr] = useState(CONTRACT_ADDRESS)
  const [price, setPrice] = useState(null)
  const [balanceAVAX, setBalanceAVAX] = useState(null)
  const [balanceUSDC, setBalanceUSDC] = useState(null)
  const [owner, setOwner] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function load(addr = contractAddr){
    if(!addr) return setError('Contract address is empty')
    setLoading(true)
    setError(null)
    try{
      const provider = getProvider()
      const contract = getContract(provider, addr)
      const [p, a, u, o] = await Promise.all([
        contract.price(),
        contract.balanceOfAVAX(),
        contract.balanceOfUSDC(),
        contract.owner()
      ])
      setPrice(p?.toString?.() ?? String(p))
      try{ setBalanceAVAX(formatEther(a)) }catch(e){ setBalanceAVAX(String(a)) }
      try{ setBalanceUSDC(formatUnits(u,6)) }catch(e){ setBalanceUSDC(String(u)) }
      setOwner(o)
    }catch(e){
      console.error('read contract error', e)
      setError(String(e))
    }finally{ setLoading(false) }
  }

  useEffect(()=>{ load(contractAddr) }, [])

  return (
    <div>
      <h1>Owner - Admin</h1>
      <div style={{maxWidth:720,marginTop:8}}>
        <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
          <label style={{fontWeight:600}}>Contract address:</label>
          <input value={contractAddr} onChange={(e)=>setContractAddr(e.target.value)} style={{fontFamily:'monospace',flex:1,padding:6,borderRadius:6,border:'1px solid #ccc'}} />
          <button onClick={()=>load(contractAddr)} style={{padding:'8px 12px'}}>Load</button>
        </div>

        <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:8}}>
          <strong>AVAX/USDC:</strong>
          <div>{price ? (Number(price) / 1000000).toFixed(6) : '—'}</div>
        </div>
        <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:8}}>
          <strong>Contract AVAX Balance:</strong>
          <div>{balanceAVAX ? `${parseFloat(balanceAVAX).toFixed(6)} AVAX` : '—'}</div>
        </div>
        <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:8}}>
          <strong>Contract USDC Balance:</strong>
          <div>{balanceUSDC ? `${parseFloat(balanceUSDC)} USDC` : '—'}</div>
        </div>
        <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:8}}>
          <strong>Owner:</strong>
          <div style={{fontFamily:'monospace'}}>{owner ?? '—'}</div>
        </div>

        <div style={{marginTop:12}}>
          <button onClick={()=>load(contractAddr)} disabled={loading} style={{padding:'8px 12px'}}>{loading ? 'Refreshing...' : 'Refresh'}</button>
          {error && <div style={{color:'red',marginTop:8}}>Error: {error}</div>}
        </div>

        <div style={{marginTop:18,fontSize:13,color:'#666'}}>Owner-only actions (hidden unless you are contract owner) will be added here.</div>
      </div>
    </div>
  )
}
