import React, {useEffect, useState} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getProvider, getContract, CONTRACT_ADDRESS } from '../utils/contract'
import { parseUnits, parseEther } from 'ethers'

export default function AdminTools(){
  const loc = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(loc.search)
  const defaultAddr = params.get('contract') || CONTRACT_ADDRESS

  const [contractAddr, setContractAddr] = useState(defaultAddr)
  const [owner, setOwner] = useState(null)
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(false)
  const [txStatus, setTxStatus] = useState(null)
  const [error, setError] = useState(null)

  const [price, setPrice] = useState(null)
  const [balanceAVAX, setBalanceAVAX] = useState(null)
  const [balanceUSDC, setBalanceUSDC] = useState(null)

  const [newPrice, setNewPrice] = useState('')
  const [withdrawAVAXAmt, setWithdrawAVAXAmt] = useState('')
  const [withdrawUSDCAmt, setWithdrawUSDCAmt] = useState('')

  async function load(addr = contractAddr){
    setLoading(true); setError(null)
    try{
      const provider = getProvider()
      const contract = getContract(provider, addr)
      const [o, p, a, u] = await Promise.all([
        contract.owner(),
        contract.price(),
        contract.balanceOfAVAX(),
        contract.balanceOfUSDC()
      ])
      setOwner(o)
      setPrice(p?.toString?.() ?? String(p))
      try{ setBalanceAVAX((await import('ethers')).formatEther(a)) }catch(e){ setBalanceAVAX(String(a)) }
      try{ setBalanceUSDC((await import('ethers')).formatUnits(u,6)) }catch(e){ setBalanceUSDC(String(u)) }

      // check signer
      try{
        const signer = await provider.getSigner()
        const me = await signer.getAddress()
        setIsOwner(me && o && me.toLowerCase() === o.toLowerCase())
      }catch(e){
        setIsOwner(false)
      }
    }catch(e){ setError(String(e)) }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ load() }, [])

  async function sendSetPrice(){
    setTxStatus('sending')
    try{
      const provider = getProvider()
      const signer = await provider.getSigner()
      const contract = getContract(signer, contractAddr)
      const val = parseFloat(newPrice)
      if(isNaN(val)) throw new Error('Invalid price')
      // contract expects uint256; user provides price*1e6? Keep UI simple: expects integer
      const tx = await contract.setPrice(Math.floor(val))
      setTxStatus(`tx: ${tx.hash}`)
      await tx.wait()
      setTxStatus('setPrice confirmed')
      await load()
    }catch(e){ setTxStatus(`error: ${String(e)}`); console.error(e) }
  }

  async function sendWithdrawAVAX(){
    setTxStatus('sending')
    try{
      const provider = getProvider()
      const signer = await provider.getSigner()
      const contract = getContract(signer, contractAddr)
      const amt = parseEther(withdrawAVAXAmt || '0')
      const tx = await contract.withdrawAVAX(amt)
      setTxStatus(`tx: ${tx.hash}`)
      await tx.wait()
      setTxStatus('withdrawAVAX confirmed')
      await load()
    }catch(e){ setTxStatus(`error: ${String(e)}`); console.error(e) }
  }

  async function sendWithdrawUSDC(){
    setTxStatus('sending')
    try{
      const provider = getProvider()
      const signer = await provider.getSigner()
      const contract = getContract(signer, contractAddr)
      const amt = parseUnits(withdrawUSDCAmt || '0', 6)
      const tx = await contract.withdrawUSDC(amt)
      setTxStatus(`tx: ${tx.hash}`)
      await tx.wait()
      setTxStatus('withdrawUSDC confirmed')
      await load()
    }catch(e){ setTxStatus(`error: ${String(e)}`); console.error(e) }
  }

  return (
    <div>
      <h1>Admin Tools</h1>
      <div style={{maxWidth:800,marginTop:8}}>
        <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
          <label style={{fontWeight:600}}>Contract address:</label>
          <input value={contractAddr} onChange={(e)=>setContractAddr(e.target.value)} style={{fontFamily:'monospace',flex:1,padding:6,borderRadius:6,border:'1px solid #ccc'}} />
          <button onClick={()=>load(contractAddr)} style={{padding:'8px 12px'}}>Load</button>
          <button onClick={()=>navigate('/')} style={{padding:'8px 12px'}}>Back</button>
        </div>

        <div style={{marginTop:12}}>
          <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:6}}>
            <strong>AVAX/USDC:</strong>
            <div>{price ? (Number(price) / 1000000).toFixed(6) : '—'}</div>
          </div>
          <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:6}}>
            <strong>Contract AVAX Balance:</strong>
            <div>{balanceAVAX ? `${parseFloat(balanceAVAX).toFixed(6)} AVAX` : '—'}</div>
          </div>
          <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:6}}>
            <strong>Contract USDC Balance:</strong>
            <div>{balanceUSDC ? `${parseFloat(balanceUSDC)} USDC` : '—'}</div>
          </div>

          <div><strong>Contract owner:</strong> <span style={{fontFamily:'monospace'}}>{owner ?? '—'}</span></div>
          <div style={{marginTop:8}}>
            <strong>Connected as owner?</strong> {isOwner ? <span style={{color:'green'}}>Yes</span> : <span style={{color:'#666'}}>No</span>}
          </div>
        </div>

        <div style={{marginTop:18,borderTop:'1px solid #eee',paddingTop:12}}>
          <h3>Owner actions</h3>
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
            <input placeholder="new price (integer)" value={newPrice} onChange={(e)=>setNewPrice(e.target.value)} style={{padding:8,borderRadius:6,border:'1px solid #ccc',flex:1}} />
            <button onClick={sendSetPrice} style={{padding:'8px 12px'}} disabled={!isOwner}>Set Price</button>
          </div>

          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
            <input placeholder="AVAX amount to withdraw" value={withdrawAVAXAmt} onChange={(e)=>setWithdrawAVAXAmt(e.target.value)} style={{padding:8,borderRadius:6,border:'1px solid #ccc',flex:1}} />
            <button onClick={sendWithdrawAVAX} style={{padding:'8px 12px'}} disabled={!isOwner}>Withdraw AVAX</button>
          </div>

          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <input placeholder="USDC amount to withdraw" value={withdrawUSDCAmt} onChange={(e)=>setWithdrawUSDCAmt(e.target.value)} style={{padding:8,borderRadius:6,border:'1px solid #ccc',flex:1}} />
            <button onClick={sendWithdrawUSDC} style={{padding:'8px 12px'}} disabled={!isOwner}>Withdraw USDC</button>
          </div>

          <div style={{marginTop:12}}>
            <div style={{fontFamily:'monospace'}}>{txStatus ?? 'idle'}</div>
            {error && <div style={{color:'red'}}>Error: {String(error)}</div>}
          </div>
        </div>

      </div>
    </div>
  )
}
