import React, {useEffect, useState} from 'react'
import { getProvider, getContract, CONTRACT_ADDRESS } from '../utils/contract'
import { formatEther, formatUnits, parseUnits, parseEther } from 'ethers'
import ABI from '../../ABI.json'

const ERC20_ABI = [
  'function approve(address spender,uint256 amount) returns (bool)',
  'function allowance(address owner,address spender) view returns (uint256)',
  'function decimals() view returns (uint8)'
]

export default function UserPage(){
  const [contractAddr, setContractAddr] = useState(CONTRACT_ADDRESS)
  const [price, setPrice] = useState(null)
  const [balanceAVAX, setBalanceAVAX] = useState(null)
  const [balanceUSDC, setBalanceUSDC] = useState(null)
  const [owner, setOwner] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // swap UI state
  const [avaxAmount, setAvaxAmount] = useState('')
  const [usdcAmount, setUsdcAmount] = useState('')
  const [swapDirection, setSwapDirection] = useState('USDC->AVAX')
  const [swapAmount, setSwapAmount] = useState('')
  const [swapError, setSwapError] = useState('')
  const [txStatus, setTxStatus] = useState(null)
  const [txPending, setTxPending] = useState(false)
  const [usdcAllowance, setUsdcAllowance] = useState(null)

  // dynamic read-only ABI functions (estimate*/max*)
  const [readFns, setReadFns] = useState([]) // {name, inputs, result, inputValues, loading}

  // helpers to format/parse token amounts (USDC:6, AVAX:18)
  const isUSDCName = (n) => n && n.toLowerCase().includes('usdc')
  const isAVAXName = (n) => n && (n.toLowerCase().includes('avax') || n.toLowerCase().includes('eth') || n.toLowerCase().includes('ether'))

  const formatResultForFn = (fname, val) => {
    try{
      if(val === null || val === undefined) return ''
      if(isUSDCName(fname)) return formatUnits(val, 6)
      if(isAVAXName(fname)) return formatEther(val)
      return val && val.toString ? val.toString() : String(val)
    }catch(e){
      return String(val)
    }
  }

  const parseInputForParam = (value, param) => {
    // addresses should be passed as-is
    if(param && param.type && param.type.startsWith('address')) return value
    const pname = (param && param.name) ? param.name.toLowerCase() : ''
    if(pname.includes('usdc')) return parseUnits(value || '0', 6)
    if(pname.includes('avax') || pname.includes('eth') || pname.includes('ether')) return parseEther(value || '0')
    // default: return raw string/number (ethers accepts decimal strings for BigNumberish)
    return value === '' ? '0' : value
  }

  async function loadAllowance(addr = contractAddr){
    try{
      const provider = getProvider()
      const signer = await provider.getSigner()
      const me = await signer.getAddress()
      const contract = getContract(provider, addr)
      const usdcAddr = await contract.usdc()
      const { Contract } = await import('ethers')
      const erc = new Contract(usdcAddr, ERC20_ABI, provider)
      const allowance = await erc.allowance(me, addr)
      setUsdcAllowance(allowance?.toString?.() ?? String(allowance))
    }catch(e){
      setUsdcAllowance(null)
    }
  }

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
      // AVAX balance is wei
      try{ setBalanceAVAX(formatEther(a)) }catch(e){ setBalanceAVAX(String(a)) }
      // USDC commonly has 6 decimals
      try{ setBalanceUSDC(formatUnits(u,6)) }catch(e){ setBalanceUSDC(String(u)) }
      setOwner(o)
      // try to load allowance (best-effort)
      loadAllowance(addr)

      // prepare read-only ABI functions that start with estimate... or max...
      const candidates = (ABI || []).filter(x => x.type === 'function' && (x.stateMutability === 'view' || x.stateMutability === 'pure') && x.name && (x.name.startsWith('estimate') || x.name.startsWith('max')))
      const prepared = candidates.map(f => ({ name: f.name, inputs: f.inputs || [], result: null, inputValues: (f.inputs||[]).map(()=>''), loading:false }))
      setReadFns(prepared)

      // auto-call zero-arg read-only functions
      for(const [i,f] of prepared.entries()){
        if(!f.inputs || f.inputs.length === 0){
          try{
            const val = await contract[f.name]()
            const s = formatResultForFn(f.name, val)
            setReadFns(prev => { const next = [...prev]; next[i] = {...next[i], result: s}; return next })
          }catch(e){
            setReadFns(prev => { const next = [...prev]; next[i] = {...next[i], result: `error: ${String(e)}`}; return next })
          }
        }
      }

    }catch(e){
      console.error('read contract error', e)
      setError(String(e))
    }finally{ setLoading(false) }
  }

  useEffect(()=>{ load(contractAddr) }, [])

  async function callReadFn(idx){
    try{
      setReadFns(prev => { const next = [...prev]; next[idx] = {...next[idx], loading:true}; return next })
      const f = readFns[idx]
      if(!f) return
      const provider = getProvider()
      const contract = getContract(provider, contractAddr)
      // build args from inputValues, parsing token amounts when parameter names indicate USDC/AVAX
      const args = (f.inputValues || []).map((v, j) => {
        const param = (f.inputs && f.inputs[j]) ? f.inputs[j] : null
        try{ return parseInputForParam(v, param) }catch(e){ return v === '' ? '0' : v }
      })
      const val = await contract[f.name](...args)
      const s = formatResultForFn(f.name, val)
      setReadFns(prev => { const next = [...prev]; next[idx] = {...next[idx], result: s, loading:false}; return next })
    }catch(e){
      setReadFns(prev => { const next = [...prev]; next[idx] = {...next[idx], result:`error: ${String(e)}`, loading:false}; return next })
    }
  }

  function updateReadFnInput(idx, inputIdx, value){
    setReadFns(prev => {
      const next = [...prev]
      const item = {...next[idx]}
      const iv = [...item.inputValues]
      iv[inputIdx] = value
      item.inputValues = iv
      next[idx] = item
      return next
    })
  }

  async function approveUSDC(){
    setTxStatus('approving')
    setTxPending(true)
    try{
      const provider = getProvider()
      const signer = await provider.getSigner()
      const contract = getContract(signer, contractAddr)
      const usdcAddr = await contract.usdc()
      const { Contract } = await import('ethers')
      const usdc = new Contract(usdcAddr, ERC20_ABI, signer)
      const amount = parseUnits(usdcAmount || '0', 6)
      const tx = await usdc.approve(contractAddr, amount)
      setTxStatus(`approving: ${tx.hash}`)
      await tx.wait()
      setTxStatus('approved')
      await loadAllowance(contractAddr)
    }catch(e){
      console.error(e)
      setTxStatus(`approve failed: ${String(e)}`)
    }finally{
      setTxPending(false)
    }
  }

  async function swapUSDCForAVAX(amountParam){
    setTxStatus('checking allowance')
    try{
      const provider = getProvider()
      const signer = await provider.getSigner()
      const me = await signer.getAddress()
      const contract = getContract(signer, contractAddr)
      const usdcAddr = await contract.usdc()
      const { Contract } = await import('ethers')
      const erc = new Contract(usdcAddr, ERC20_ABI, provider)
      const allowance = await erc.allowance(me, contractAddr)
      const amountStr = amountParam ?? usdcAmount ?? swapAmount ?? '0'
      const amount = parseUnits(amountStr || '0', 6)

      // If allowance is insufficient, prompt approval (wallet) and wait
      if(allowance < amount){
        setTxStatus('approval required — opening wallet')
        setTxPending(true)
        try{
          const usdc = new Contract(usdcAddr, ERC20_ABI, signer)
          const tx = await usdc.approve(contractAddr, amount)
          setTxStatus(`approving: ${tx.hash}`)
          await tx.wait()
          setTxStatus('approved')
          await loadAllowance(contractAddr)
        }catch(e){
          console.error('approve failed', e)
          setTxStatus(`approve failed: ${String(e)}`)
          setTxPending(false)
          return
        }
      }
    }catch(e){
      console.error('allowance check failed', e)
      setTxStatus(`allowance check failed: ${String(e)}`)
      return
    }

    // proceed to swap
    setTxStatus('swapping-usdc')
    setTxPending(true)
    try{
      const provider = getProvider()
      const signer = await provider.getSigner()
      const contract = getContract(signer, contractAddr)
      const amount = parseUnits(amountParam ?? usdcAmount ?? swapAmount ?? '0', 6)
      const tx = await contract.swapUSDCForAVAX(amount)
      setTxStatus(`tx: ${tx.hash}`)
      await tx.wait()
      setTxStatus('swap-usdc-confirmed')
      await load(contractAddr)
      await loadAllowance(contractAddr)
    }catch(e){
      console.error(e)
      setTxStatus(`swap failed: ${String(e)}`)
    }finally{
      setTxPending(false)
    }
  }

  async function swapAVAXForUSDC(amountParam){
    setTxStatus('swapping-avax')
    setTxPending(true)
    try{
      const provider = getProvider()
      const signer = await provider.getSigner()
      const contract = getContract(signer, contractAddr)
      const value = parseEther(amountParam ?? avaxAmount ?? swapAmount ?? '0')
      const tx = await contract.swapAVAXForUSDC({ value })
      setTxStatus(`tx: ${tx.hash}`)
      await tx.wait()
      setTxStatus('swap-avax-confirmed')
      await load(contractAddr)
    }catch(e){
      console.error(e)
      setTxStatus(`swap failed: ${String(e)}`)
    }finally{
      setTxPending(false)
    }
  }

  async function handleSwap(){
    setSwapError('')

    // require wallet connected (signer present)
    try{
      const provider = getProvider()
      const signer = await provider.getSigner()
      try{ await signer.getAddress() }catch(e){ setSwapError('Connect wallet first'); return }
    }catch(e){ setSwapError('Connect wallet first'); return }

    // basic validation
    if(!swapAmount || isNaN(Number(swapAmount))){
      setSwapError('Invalid amount')
      return
    }
    try{
      const provider = getProvider()
      const contract = getContract(provider, contractAddr)
      if(swapDirection === 'USDC->AVAX'){
        // check maxUSDCtoSwap (best-effort). If check fails, continue and let the contract revert if needed.
        let max = null
        try{
          max = await contract.maxUSDCtoSwap()
        }catch(e){
          console.warn('maxUSDCtoSwap check failed, proceeding without max check', e)
        }
        if(max){
          try{
            const amt = parseUnits(swapAmount || '0', 6)
            if(max < amt){
              setSwapError(`max USDC is ${formatUnits(max,6)}`)
              return
            }
          }catch(e){
            console.warn('compare failed', e)
          }
        }
        await swapUSDCForAVAX(swapAmount)
      }else{
        // AVAX->USDC: check maxAVAXtoSwap (best-effort)
        let max = null
        try{
          max = await contract.maxAVAXtoSwap()
        }catch(e){
          console.warn('maxAVAXtoSwap check failed, proceeding without max check', e)
        }
        if(max){
          try{
            const amt = parseEther(swapAmount || '0')
            if(max < amt){
              setSwapError(`max AVAX is ${formatEther(max)}`)
              return
            }
          }catch(e){
            console.warn('compare failed', e)
          }
        }
        await swapAVAXForUSDC(swapAmount)
      }
    }catch(e){
      console.error('handleSwap error', e)
      setSwapError(String(e))
    }
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
        <h1 style={{display:'flex',alignItems:'center',gap:8,margin:0}}><span style={{fontSize:16,fontWeight:600}}>Network:</span> <span style={{display:'inline-block',padding:'2px 8px',border:'1px solid #ddd',borderRadius:6,fontSize:13,color:'#666',lineHeight:1}}>Avalanche Fuji</span></h1>
      </div>
      <div style={{maxWidth:720,marginTop:8}}>

        <div style={{marginTop:20,borderTop:'1px solid #eee',paddingTop:20}}>
          <h3 style={{textAlign:'center',margin:'0 0 20px'}}>Swap freely on-chain</h3>
        <div style={{display:'flex',flexDirection:'column',gap:14,alignItems:'stretch',margin:'0 auto 12px',maxWidth:420}}>
          <select value={swapDirection} onChange={(e)=>setSwapDirection(e.target.value)} style={{padding:12,borderRadius:8,border:'1px solid #ccc',background:'#fff',width:'100%',boxSizing:'border-box'}}>
              <option value="USDC->AVAX">USDC → AVAX</option>
              <option value="AVAX->USDC">AVAX → USDC</option>
            </select>
          <input placeholder={swapDirection === 'USDC->AVAX' ? 'Amount in USDC' : 'Amount in AVAX'} value={swapAmount} onChange={(e)=>setSwapAmount(e.target.value)} style={{padding:12,borderRadius:8,border:'1px solid #ccc',width:'100%',boxSizing:'border-box'}} />
            <div style={{minHeight:18,marginTop:6,marginBottom:6,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <div style={{color:'#d93025',fontSize:13}}>{swapError}</div>
            </div>
          <button onClick={handleSwap} style={{padding:'12px 12px',width:'100%',marginTop:6}} disabled={txPending}>Swap</button>
          </div>
        </div>

      </div>
    </div>
  )
}
