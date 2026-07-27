import React, {useState, useEffect, useRef} from 'react'
import { getInjectedProviders, getProvider, setInjectedProvider, FUJI_RPC } from '../utils/contract'
import { formatEther } from 'ethers'
import iconImg from '../../icon.jpg'

const FUJI_CHAIN_ID = '0xa869' // 43113

function getWalletName(provider, fallback = 'Wallet'){
  if(!provider) return fallback
  if(provider.isMetaMask) return 'MetaMask'
  if(provider.isCoinbaseWallet) return 'Coinbase Wallet'
  if(provider.isRabby) return 'Rabby Wallet'
  if(provider.isBraveWallet) return 'Brave Wallet'
  if(provider.isTrust) return 'Trust Wallet'
  if(provider.isOKExWallet || provider.isOkxWallet) return 'OKX Wallet'
  if(provider.isCore) return 'Core Wallet'
  return fallback
}

export default function Header(){
  const [account, setAccount] = useState(null)
  const [chainId, setChainId] = useState(null)
  const [balance, setBalance] = useState(null)
  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [walletPickerOpen, setWalletPickerOpen] = useState(false)
  const [walletOptions, setWalletOptions] = useState([])
  const [announcedProviders, setAnnouncedProviders] = useState([])
  const [activeProvider, setActiveProvider] = useState(null)
  // when users click our Disconnect button, remember intent so UI stays disconnected
  const [manuallyDisconnected, setManuallyDisconnected] = useState(()=>{ try{ return localStorage.getItem('manuallyDisconnected') === '1'}catch(e){return false}})
  // ref to ignore provider events while a connect request is in progress
  const connectInProgressRef = useRef(false)

  function getWalletOptions(){
    const options = new Map()
    getInjectedProviders().forEach(provider => {
      options.set(provider, { provider, name: getWalletName(provider) })
    })
    announcedProviders.forEach(({ info, provider }) => {
      options.set(provider, {
        provider,
        name: info.name || getWalletName(provider),
        icon: info.icon
      })
    })
    return [...options.values()]
  }

  async function ensureFuji(provider = activeProvider){
    if(!provider) return
    try{
      const current = await provider.request({method:'eth_chainId'})
      setChainId(current)
      if(current !== FUJI_CHAIN_ID){
        try{
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: FUJI_CHAIN_ID }]
          })
          setChainId(FUJI_CHAIN_ID)
        }catch(switchErr){
          // 4902: chain not added
          if(switchErr?.code === 4902){
            try{
              await provider.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: FUJI_CHAIN_ID,
                  chainName: 'Avalanche Fuji Testnet',
                  nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
                  rpcUrls: [FUJI_RPC],
                  blockExplorerUrls: ['https://testnet.snowtrace.io/']
                }]
              })
              setChainId(FUJI_CHAIN_ID)
            }catch(addErr){
              console.error('Failed to add Fuji chain', addErr)
            }
          }else{
            console.error('Failed to switch chain', switchErr)
          }
        }
      }
    }catch(e){
      console.error('ensureFuji error', e)
    }
  }

  async function updateBalance(acc){
    if(!acc) return setBalance(null)
    try{
      // use provider if available
      const provider = getProvider()
      const bal = await provider.getBalance(acc)
      setBalance(formatEther(bal))
    }catch(e){
      console.error('getBalance error', e)
    }
  }

  async function connect(provider = activeProvider){
    if(provider){
      connectInProgressRef.current = true
      try{
        setInjectedProvider(provider)
        setActiveProvider(provider)
        const accs = await provider.request({method:'eth_requestAccounts'})
        const a = accs[0]
        setAccount(a)
        try{ localStorage.removeItem('manuallyDisconnected') }catch(e){}
        setManuallyDisconnected(false)
        await ensureFuji(provider)
        await updateBalance(a)
      }catch(e){
        // user canceled or other error — keep manual disconnect flag if present
        console.error('connect error', e)
      }finally{
        connectInProgressRef.current = false
      }
    }else{
      alert('No compatible wallet found')
    }
  }

  async function openWalletPicker(){
    const options = getWalletOptions()
    if(options.length === 0){
      alert('No compatible wallet found')
    }else if(options.length === 1){
      await connect(options[0].provider)
    }else{
      setWalletOptions(options)
      setWalletPickerOpen(true)
    }
  }

  useEffect(()=>{
    const handleProviderAnnouncement = (event) => {
      const detail = event.detail
      if(!detail?.provider) return
      setAnnouncedProviders(prev => prev.some(item => item.provider === detail.provider) ? prev : [...prev, detail])
    }

    window.addEventListener('eip6963:announceProvider', handleProviderAnnouncement)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    return ()=> window.removeEventListener('eip6963:announceProvider', handleProviderAnnouncement)
  },[])

  useEffect(()=>{
    const provider = activeProvider
    if(!provider) return
    const handleAccounts = (accs)=>{
      // If a connect request is in progress, ignore account events until it settles
      if(connectInProgressRef.current) return

      // Respect manual disconnect stored in localStorage to avoid race conditions
      let persisted = false
      try{ persisted = localStorage.getItem('manuallyDisconnected') === '1' }catch(e){}
      if(persisted){
        if(accs.length === 0){
          // provider actually disconnected, clear UI and reset flag
          setAccount(null)
          try{ localStorage.removeItem('manuallyDisconnected') }catch(e){}
          setManuallyDisconnected(false)
        }
        return
      }

      if(accs.length === 0){
        setAccount(null)
      }else{
        setAccount(accs[0])
        updateBalance(accs[0])
      }
    }
    const handleChain = (chain)=>{
      setChainId(chain)
    }

    const addEthListener = (event, handler) => {
      if(typeof provider.on === 'function') provider.on(event, handler)
      else if(typeof provider.addListener === 'function') provider.addListener(event, handler)
      else console.warn('No supported add-listener on window.ethereum')
    }
    const removeEthListener = (event, handler) => {
      if(typeof provider.removeListener === 'function') provider.removeListener(event, handler)
      else if(typeof provider.off === 'function') provider.off(event, handler)
      else if(typeof provider.removeEventListener === 'function') provider.removeEventListener(event, handler)
      else console.warn('No supported remove-listener on window.ethereum')
    }

    try{ addEthListener('accountsChanged', handleAccounts) }catch(e){ console.warn('accountsChanged listener failed', e) }
    try{ addEthListener('chainChanged', handleChain) }catch(e){ console.warn('chainChanged listener failed', e) }
    // initial state
    (async ()=>{
      try{
        // if user manually disconnected (persisted), don't auto-set account from provider
        let persistedInit = false
        try{ persistedInit = localStorage.getItem('manuallyDisconnected') === '1' }catch(e){}
        if(!persistedInit){
          const accs = await provider.request({method:'eth_accounts'})
          if(accs.length) { setAccount(accs[0]); updateBalance(accs[0]) }
        }
        const cid = await provider.request({method:'eth_chainId'})
        setChainId(cid)
      }catch(e){/* ignore */}
    })()
    return ()=>{
      try{ removeEthListener('accountsChanged', handleAccounts) }catch(e){}
      try{ removeEthListener('chainChanged', handleChain) }catch(e){}
    }
  },[manuallyDisconnected, activeProvider])

  // refresh balance when account or chain changes
  useEffect(()=>{
    if(account) updateBalance(account)
  },[account, chainId])

  // dropdown menu behavior
  const menuRef = useRef(null)
  useEffect(()=>{
    if(!menuOpen) return
    function onDoc(e){
      if(menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('click', onDoc)
    return ()=> document.removeEventListener('click', onDoc)
  },[menuOpen])

  // toggle menu (stop propagation so document handler doesn't immediately close when clicking the button)
  function toggleMenu(e){
    if(e && typeof e.stopPropagation === 'function') e.stopPropagation()
    setMenuOpen(v=>!v)
  }

  const networkLabel = chainId === FUJI_CHAIN_ID ? 'Fuji (43113)' : (chainId ? `Chain ${chainId}` : 'Not connected')

  return (
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:10,borderBottom:'1px solid #eee'}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <img src={iconImg} alt="icon" style={{width:46,height:46,borderRadius:8,objectFit:'cover'}} />
        <div>
          <div style={{fontWeight:800,fontSize:18}}>We Swap!</div>
          <div style={{fontWeight:600,fontSize:14,marginTop:6}}>One-stop decentralized swap platform, Instant USDC & AVAX exchange!</div>
        </div>
      </div>
      <div style={{display:'flex',gap:12,alignItems:'center'}}>
        {balance && <div style={{fontSize:13}}>{parseFloat(balance).toFixed(4)} AVAX</div>}
        {account && !manuallyDisconnected ? (
          (()=>{
          const walletName = getWalletName(activeProvider)
          return (
            <div style={{position:'relative'}} ref={menuRef}>
              <button onClick={toggleMenu} style={{fontFamily:'monospace'}}>
                {walletName}: {account.slice(0,6)}...{account.slice(-4)}
              </button>
              {copied && <span style={{fontSize:12,color:'#666',marginLeft:8}}>Copied</span>}

              {menuOpen && (
                <>
                  <div onClick={()=>setMenuOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.16)',zIndex:999}} />
                  <div style={{position:'absolute',right:0,top:'calc(100% + 8px)',background:'#f7f8fb',border:'1px solid #d9dbe1',boxShadow:'0 8px 24px rgba(0,0,0,0.08)',borderRadius:8,padding:10,minWidth:220,zIndex:1000}}>
                    <div style={{fontWeight:600,marginBottom:8,color:'#000'}}>Wallet Address</div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontFamily:'monospace',fontSize:13,marginBottom:8}}>
                      <div style={{overflow:'hidden',textOverflow:'ellipsis',color:'#000'}}>{account}</div>
                      <button onClick={async ()=>{ try{ await navigator.clipboard.writeText(account); setCopied(true); setTimeout(()=>setCopied(false),2000)}catch(e){console.error('copy failed',e)} }} title="Copy address" aria-label="Copy address" style={{marginLeft:8,border:'none',background:'transparent',padding:6}}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 1H4C2.89543 1 2 1.89543 2 3V15H4V3H16V1Z" fill="#333"/><path d="M20 5H8C6.89543 5 6 5.89543 6 7V21C6 22.1046 6.89543 23 8 23H20C21.1046 23 22 22.1046 22 21V7C22 5.89543 21.1046 5 20 5ZM20 21H8V7H20V21Z" fill="#333"/></svg>
                      </button>
                    </div>
                    <div style={{borderTop:'1px solid #f1f1f1',paddingTop:8}}>
                      <button onClick={()=>{ setMenuOpen(false); setAccount(null); setBalance(null); setCopied(false); try{ localStorage.setItem('manuallyDisconnected','1') }catch(e){}; setManuallyDisconnected(true); }} style={{width:'100%',background:'#fff',border:'1px solid #e74c3c',color:'#e74c3c',padding:8,borderRadius:6}}>Disconnect</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )
          })()
        ) : (
          <button onClick={openWalletPicker}>Connect Wallet</button>
        )}
      </div>
      {walletPickerOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="wallet-picker-title" style={{position:'fixed',inset:0,display:'grid',placeItems:'center',padding:20,background:'rgba(0,0,0,0.4)',zIndex:1100}}>
          <div style={{width:'min(360px, 100%)',background:'#fff',color:'#0D3A59',borderRadius:10,padding:20,boxShadow:'0 12px 32px rgba(0,0,0,0.24)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
              <h2 id="wallet-picker-title" style={{fontSize:18,margin:0}}>Choose a wallet</h2>
              <button onClick={()=>setWalletPickerOpen(false)} aria-label="Close wallet selection" style={{padding:'4px 8px'}}>Close</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:16}}>
              {walletOptions.map(({ provider, name, icon }, index) => (
                <button key={`${name}-${index}`} onClick={()=>{ setWalletPickerOpen(false); connect(provider) }} style={{display:'flex',alignItems:'center',gap:10,textAlign:'left',background:'#fff',color:'#0D3A59',border:'1px solid #d9dbe1'}}>
                  {icon && <img src={icon} alt="" style={{width:24,height:24,borderRadius:4}} />}
                  <span>{name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
